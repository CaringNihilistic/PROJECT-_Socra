# Socra

> An AI startup evaluator that refuses to give a masterplan until it fully understands your idea. It interrogates the founder Socratically, scores the idea across 5 dimensions, then unlocks a multi-agent council analysis + a synthesized "Chairman's Masterplan".

---

## Tech Stack

### Backend (`backend/`)
| Component | Choice | Version |
|---|---|---|
| Language | Python | 3.11 |
| Framework | FastAPI | 0.115.0 |
| Server | Uvicorn (standard) | 0.30.0 |
| ORM | SQLAlchemy (asyncio) | 2.0.35 |
| DB driver | asyncpg | 0.29.0 |
| Database | PostgreSQL | 15 |
| Config | pydantic-settings | 2.5.0 |
| LLM SDKs | anthropic 0.40.0, openai 1.50.0 (also Google Gemini + Groq via HTTP) |
| Observability | langfuse ≥3.0.0 (optional — traces LLM calls) | — |
| Agent orchestration | langgraph ≥0.2.60,<0.3 | — |
| Graph checkpointing | langgraph-checkpoint-postgres ≥2.0 + psycopg[binary,pool] ≥3.1 | — |
| Payments | razorpay | 1.4.2 |
| Auth | Clerk (JWT verify via python-jose) | — |
| HTTP | httpx | 0.27.0 |

### Frontend (`frontend/`)
| Component | Choice | Version |
|---|---|---|
| Language | TypeScript | 5.5.3 |
| Framework | React | 18.3.1 |
| Build tool | Vite | 5.3.4 |
| Styling | Tailwind CSS | 3.4.7 |
| Fonts | Jersey 15 (`font-pixel`: titles and names) + Atkinson Hyperlegible (`font-term`: all text). Pixel UI throughout | self-hosted in `frontend/public/fonts` |
| State | Zustand | 5.0.0 |
| Auth | @clerk/clerk-react | 5.0.0 |
| HTTP | axios | 1.7.0 |
| Markdown | react-markdown 9.0.0 + remark-gfm 4.0.1 |
| Image export | html-to-image 1.11 (score card → PNG, pixel fonts inlined in `share/pngExport.ts`) |

### Infra
- **Hosting:** Render free tier via [render.yaml](render.yaml) — backend = Docker web service, frontend = static site. Database = Neon free Postgres (Render's free Postgres is deleted after 30 days).
- **Local dev:** Docker Compose (postgres + backend + frontend)

---

## LLM Routing

All LLM calls flow through `backend/llm_client.py`, which routes by priority with automatic fallthrough:

1. **Anthropic Haiku 4.5** (`claude-haiku-4-5-20251001`) — primary
2. **Google Gemini** (`GOOGLE_MODEL` = `gemini-flash-latest`) — fallback
3. **Groq** (`GROQ_FAST_MODEL` = `qwen/qwen3.8-27b`, `GROQ_LARGE_MODEL` = `openai/gpt-oss-120b`) — final fallback

Fallback model IDs live in constants at the top of the LLM helpers section of `llm_client.py`. Providers retire them with little notice: in Sep 2026 `gemini-2.0-flash`, `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` all 404'd at once and every call failed with a 503. Both Groq models are reasoning models, so keep their `max_tokens` generous: hidden thinking shares the budget, and a tight cap returns empty content.

**Production runs Anthropic with Groq fallback** (no `GOOGLE_API_KEY` on Render). Every Anthropic path falls through to Groq when the key is dead or unfunded, and logs why (`Anthropic … failed, falling back:`). Without an Anthropic key the app runs fully free on Groq. A Google key on the free tier makes turns take minutes, because the OpenAI SDK retries Gemini's 429/503 responses with backoff before falling through. Anthropic `claude-haiku-4-5-20251001` retires no sooner than 2026-10-15. Output is kept **crisp by the prompts, not just the caps**: Socra's replies ≤ 60 words, each council report exactly 4 bullets (bold verdict + one ≤ 20-word sentence, `AGENT_FORMAT`), the masterplan ≤ 450 words under fixed `##` headings, 5 one-line Team Glitch critiques; key words are bolded throughout. Caps: `SYNTHESIS_MAX_TOKENS` 3000 for Anthropic/Google (a safety net: at 2000 a live plan overshot and lost its last section; the prompt ends with a FINAL CHECK of the hard limits), `GROQ_SYNTHESIS_MAX_TOKENS` 8000 for Groq (reasoning models spend hidden thinking from the same budget). A cap alone truncates mid-plan: at 3000, before the prompts were tightened, every plan was cut off mid-Phase 1/2. `backend/tests/test_prompts.py` pins the `##` headings the frontend splits the plan on. The masterplan prompt is a **fill-in template**, and on Anthropic the answer is **prefilled** with `SYNTHESIS_PREFILL` (`## Chairman's Verdict`, yielded as the plan's first token): instructions alone let a live run invent its own sections and drop Tech Stack and the Phases. `tests/test_synthesis_stream.py` covers the prefill and that an Anthropic failure before any text still falls through to Groq.

`STUB_MODE=true` (or no LLM key set) activates canned demo responses that only work for the **3 example ideas on the landing page**.

Key conventions in the LLM layer:
- The `###JSON###` separator splits streamed text (Part 1, shown to user) from eval JSON (Part 2, parsed by backend).
- Agent/synthesis calls use `_build_agent_msgs` — a single clean user message (idea + founder's answers + web research), **not** the raw Q&A history. Passing Q&A history makes LLMs generate more questions instead of analysis.
- All messages are sanitized to Anthropic's strict validation (no empty `messages[]`, no consecutive same-role, must start with `user`) before any provider call.

## LangGraph Pipeline (Admin + User Selectable)

The council of 5 agents can run through either the **legacy asyncio pipeline** or a **LangGraph StateGraph** pipeline. Dev/admin users pick the engine with the `◎ LEGACY` / `⬡ LANGGRAPH` toggle in the chat screen's shortcuts; the choice persists in localStorage (`socra_pipeline`). Everyone else runs the legacy pipeline.

**Graph topology** (`backend/llm_graph/council_graph.py`):
```
START → web_research → agent_finance ─┐
                     → agent_market  ─┤
                     → agent_comp   ─┼→ synthesis → devils_advocate → END
                     → agent_tech   ─┤
                     → agent_risk   ─┘
```

- All 5 agents run in the same LangGraph superstep (true parallel)
- `operator.add` reducer on `agent_reports` merges 5 concurrent outputs
- `get_stream_writer()` bridges token streaming — existing `_stream_synthesis_tokens()` runs unchanged inside nodes
- **Phase 2:** `AsyncPostgresSaver` with a separate psycopg v3 pool persists state after each node, on a **fresh thread per run** (`{session_id}:{uuid}`). Re-using `thread_id=session_id` made the `operator.add` reducer double `agent_reports` on every re-run (proven: 5 → 10). A failed run is **not** resumed: passing input restarts from START
- Falls back to legacy pipeline for stub mode and Groq-only path
- Enabled via `LANGGRAPH_ENABLED=true` + `?use_langgraph=true` query param on `/unlock`
- Benchmark: LangGraph 52s vs Legacy 62s at identical cost ($0.022)

---

## Project Structure

```
PROJECT _STARTUP/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting, /health
│   ├── llm_client.py            # LLM routing, council agents, masterplan (largest file)
│   ├── observability.py         # Langfuse v4 tracing — ContextVar session propagation, trace_generation()
│   ├── eval_bar.py              # 5-dimension scoring + phase thresholds
│   ├── web_search.py            # Tavily live market research
│   ├── llm_graph/
│   │   ├── __init__.py
│   │   ├── council_graph.py     # LangGraph StateGraph — parallel 5-agent council
│   │   └── checkpointer.py      # AsyncPostgresSaver with separate psycopg pool
│   ├── core/
│   │   ├── config.py            # Settings (env vars) via pydantic-settings
│   │   └── auth.py              # Clerk JWT verification + admin role
│   ├── db/
│   │   ├── database.py          # Async engine + session + init_db
│   │   └── models.py            # Session + WaitlistEntry tables
│   └── api/routes/
│       ├── sessions.py          # CRUD, admin-mark-paid, assumptions, access checks
│       ├── architect.py         # Streaming chat, unlock (?use_langgraph), masterplan, admin seed
│       ├── billing.py           # Razorpay checkout / webhook / verify
│       ├── waitlist.py          # Email waitlist signup
│       ├── followup.py          # Follow-up email capture + admin send
│       └── me.py                # GET /me — current identity + is_admin
├── frontend/
│   └── src/
│       ├── App.tsx              # Routing (path-based), Clerk provider, payment-return handling
│       ├── store/sessionStore.ts # Zustand store — all state + API calls + SSE streaming + pipelinePreference + episode
│       ├── pixel/               # Pixel redesign kit: sprites (32×32, code-drawn), cast, UI components
│       ├── episode/             # Council episode engine: SSE reader, reducer, pacer, replay (pure, tested)
│       ├── chat/                # Interrogation helpers: visible turns, dialog line, stages/evolution (pure, tested)
│       ├── landing/             # Journey demo timeline over a recorded run (pure, tested)
│       ├── share/               # Card grade/flavour and compare pairs (pure, tested)
│       ├── lib/auth.tsx         # Clerk helpers
│       └── components/          # Pages + views (see below)
├── docker-compose.yml
├── .env.example
└── JOURNEY*.md                  # Build journals (phase-by-phase history, gitignored)
```

---

## Key Pages & Components (frontend)

Routing is **path-based** in `App.tsx` (no router library) — public share/card/compare routes bypass auth.

| Component | Purpose |
|---|---|
| `LandingPage.tsx` | Pixel **title screen** (NAME YOUR IDEA, 3 STUB_MODE examples, CONTINUE saves + compare picker), **WATCH A RUN** journey demo (`landing/JourneyDemo`, a real recorded run replayed through the real chat/council components; dev: `?journey=<ms>` pins a moment), How it plays, cast, Free to play, Get updates (`/waitlist`) |
| `SessionPage.tsx` | Pixel header + tabs **Chat** · **Results**. Chat is the **Interrogation battle screen** (`chat/BattleScreen`): your idea as a creature (stage sprite, XP bar, 5 stat bars with Socra's notes), Prof. Socra's dialog, a pre-filling answer menu, field notes (assumptions), a collapsible log; crossing a phase threshold plays the **evolution scene** (`chat/EvolutionScene`, store `evolution`). While the council runs, the pixel **Council episode** overlay plays (`council/EpisodePlayer`); Results (`council/Results`) shows creature cards, Team Glitch and the trainer-presented plan, with **Watch episode** replay. Pipeline selector + `[DEV]` shortcuts. Dev-only pages: `/__pixel`, `/__episode`, `/__chat` |
| `CardPage.tsx` | **Public** score card (`/card/:id`): the idea as a pixel **trading card** (`share/TradingCard`: HP = score, 5 stats, rarity frame by grade, the Chairman's verdict as flavour text) with DOWNLOAD PNG |
| `SharePage.tsx` | **Public** masterplan (`/share/:id`): the Results view read-only, with the council episode replayable by visitors (`episode/usePlayback`) |
| `ComparePage.tsx` | **Public** VS screen (`/compare/:id1/:id2`): the two idea creatures face off, mirrored stat bars, each council creature's two signatures |
| `FollowUpEmailCapture.tsx` | Email capture for follow-up nudges |

### Backend Routes
- `POST /sessions/` — create session. The frontend passes `?stream=true`: the idea is stored and returned at once, then `POST /sessions/{id}/start/stream` streams the opening question through the same path as every turn (first words in ~1.5 s instead of a blank ~5 s; 409 if the session already has its question). Without the flag the question is generated inline (old behaviour) · `GET /sessions/` — list · `GET /sessions/{id}` — fetch (full payload incl. the conversation transcript for the owner/admin; a redacted public view, used by `/share`, `/card`, `/compare`, for everyone else)
- `GET /me` — returns `{user_id, email, is_admin}` for the current Clerk token (frontend uses it to show admin shortcuts)
- `POST /sessions/{id}/admin-mark-paid` — **admin bypass** (sets paid; requires caller on `ADMIN_EMAILS` allowlist)
- `POST /sessions/{id}/admin-seed-conversation` — **admin**: auto-plays a founder conversation, generates the masterplan, marks paid (quality testing)
- `POST /sessions/{id}/message/stream` — SSE Socratic chat
- `POST /sessions/{id}/unlock?use_langgraph=true` — run council + masterplan; optional `use_langgraph` query param routes to LangGraph pipeline when `LANGGRAPH_ENABLED=true`
- `POST /sessions/{id}/pitch-deck` — generate pitch deck
- `POST /billing/checkout` · `/billing/webhook` · `/billing/verify` — Razorpay
- `POST /waitlist` · `POST /sessions/{id}/follow-up` · `POST /admin/send-follow-ups`
- `GET /health` — checks real DB connection · `GET /ping` — no DB; the frontend calls it on every page load so a sleeping Render instance starts booting while the visitor reads

---

## Council Agents

**Council (5 specialists, run in parallel):**
- 💼 The Banker (finance/unit economics) · 🔮 The Oracle (market/TAM) · ⚔️ The Challenger (competition) · 🔧 The Builder (tech) · 🎯 The Skeptic (risk)
- Then a Devil's Advocate critique + Chairman's Masterplan synthesis.

> **Tribunal mode was removed.** The `sessions.mode` column is kept only so legacy `"tribunal"` rows are hidden from `GET /sessions/` and 404 on `GET /sessions/{id}`. Every new session is `"standard"`.

---

## The Eval Bar (scoring)

5 weighted dimensions in `eval_bar.py` gate which phase the session is in:

| Dimension | Weight |
|---|---|
| problem_clarity | 25% |
| scale_constraints | 20% |
| tech_context | 20% |
| success_definition | 20% |
| risk_awareness | 15% |

Phase thresholds: `intake` (0.0) → `debate` (0.40) → `stress_test` (0.70) → `masterplan` (0.80). Crossing 0.80 starts the council and masterplan automatically inside that chat turn's stream (turn 9 forces it). It is **free**: there is no paywall, only an optional ₹499 donation after the results (Razorpay).

---

## Environment Variables

### Backend (`.env` / Render)
| Var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Primary LLM | "" |
| `GOOGLE_API_KEY` | Gemini fallback | "" |
| `GROQ_API_KEY` | Groq fallback | "" |
| `TAVILY_API_KEY` | Live market research | "" |
| `STUB_MODE` | Offline demo (true = no real LLM) | "true" |
| `DATABASE_URL` | Postgres connection. Neon/Render-style URLs work as-is: `sslmode`/`channel_binding` are translated for asyncpg in `db/database.py`. Use Neon's **direct** (non-pooled) string. | local docker |
| `SECRET_KEY` | App secret | dev placeholder |
| `CLERK_SECRET_KEY` | Clerk JWT verification | "" |
| `CLERK_FRONTEND_API_URL` | Clerk issuer (e.g. `https://xxx.clerk.accounts.dev`) | "" |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Payments | "" |
| `RAZORPAY_PRICE_AMOUNT` | Masterplan price in paise | 49900 (₹499) |
| `RESEND_API_KEY` | Follow-up emails | "" |
| `FRONTEND_ORIGIN` | CORS allowed origin | localhost:5173 |
| `ADMIN_EMAILS` | Comma-separated allowlist of admin Clerk emails (or user IDs). Grants payment bypass, skip-to-masterplan, conversation seeding, and view-any-session. Verified via the caller's Clerk token. | "" |
| `ADMIN_SECRET` | Legacy — no longer used for admin gating (kept for back-compat) | "" |
| `LANGFUSE_PUBLIC_KEY` | Langfuse observability — public key (safe to expose) | "" |
| `LANGFUSE_SECRET_KEY` | Langfuse observability — secret key | "" |
| `LANGFUSE_HOST` | Langfuse host (US server: `https://us.cloud.langfuse.com`) | "https://cloud.langfuse.com" |
| `LANGGRAPH_ENABLED` | Enable LangGraph council pipeline + Postgres checkpointing | false |

### Frontend (Vite — must be set at **build time**)
| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key (auth disabled if unset) |
| `VITE_RAZORPAY_KEY_ID` | Controls `BILLING_ENABLED` — when **unset**, `[DEV]` skip-payment buttons appear |
| `VITE_ADMIN_SECRET` | Legacy — no longer used (admin is identity-based via Clerk now) |

---

## How to Run / Build / Deploy

### Local development (Docker Compose — recommended)
```bash
cp .env.example .env        # add ANTHROPIC_API_KEY, set STUB_MODE=false for real responses
docker compose up           # starts postgres, backend (:8000), frontend (:3000)
```
- Frontend: http://localhost:3000 · Backend: http://localhost:8000 · Docs: http://localhost:8000/docs
- HMR on Windows requires Vite polling (`usePolling`). After changing dependencies, rebuild with `docker compose up --build` (not just restart).

### Backend standalone
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend standalone
```bash
cd frontend
npm install
npm run dev          # dev server (Vite)
npm run build        # tsc typecheck + production build → dist/
npm run preview      # preview the production build
```
> `npm run build` runs `tsc` first — **unused variables/imports fail the build.** This breaks deploys; keep the TS clean.

### Deploy (Render free tier + Neon)
- [render.yaml](render.yaml) is a Render Blueprint defining both services. Push to `main` → Render auto-deploys.
- **Backend** (`socra-backend`): Docker web service built from `backend/Dockerfile` (python:3.11-slim, binds `${PORT}`). Free plan **sleeps after 15 min idle; the next request cold-starts in ~1 min**.
- **Frontend** (`socra-frontend`): static site (`npm run build` → `frontend/dist`) with a `/* → /index.html` rewrite so `/share`, `/card`, `/compare` resolve. `frontend/Dockerfile` is only used by local compose. **`VITE_*` vars are baked in at build time** — changing them requires a rebuild.
- **Database**: Neon free Postgres (0.5 GB, 100 CU-hours/month, scales to zero after 5 min). Don't add keep-warm pings to `/health` — it queries the DB, keeps Neon awake 24/7 and exhausts the free compute budget. Keep-warm pings go to `/ping`, which never touches the DB (an external cron every 10 min keeps the free Render instance awake; one always-on service fits Render's 750 free hours/month).
- Live URLs: backend `https://socra-backend-efmq.onrender.com`, frontend `https://socra-frontend-efmq.onrender.com` (Render suffixed the service names). Both are pinned in `render.yaml` as `FRONTEND_ORIGIN` / `VITE_API_URL`; `FRONTEND_ORIGIN` must exactly match the frontend URL (no trailing slash) since CORS and the Razorpay callback allowlist both derive from it.
- Set `VITE_RAZORPAY_KEY_ID` in production — when unset, `BILLING_ENABLED` is false and every visitor sees the `[DEV]` shortcuts.

---

## Code Style Conventions

### Backend (Python)
- 4-space indent, type hints on function signatures, module-level docstrings.
- Async throughout (FastAPI + SQLAlchemy asyncio). Routes are `async def`.
- Settings accessed via the singleton `from core.config import settings`.
- Errors never leak stack traces to the client — global handler returns generic 500; details are logged server-side.
- LLM message lists are always sanitized to Anthropic's strict rules before any call.
- Section dividers use `# ---...---` comment banners.

### Frontend (TypeScript / React)
- Functional components, named exports (`export function X`).
- **All** state + API calls + SSE streaming live in the Zustand store (`sessionStore.ts`) — components are mostly presentational.
- Tailwind utility classes with the pixel tokens (`px-*` colours, `font-pixel` / `font-term`) and the kit in `pixel/ui`; no inline rgba styling. The two fonts replaced VT323 and Press Start 2P (a designer found those hard to read) and are scaled with `size-adjust` in `index.css` to fill the same boxes, so the old size rules still hold: `font-term` text is never below 20px, `font-pixel` never below 10px. `share/pngExport.ts` repeats the same `size-adjust` values. Sprites render only at 32/64/96/128px.
- No router library — routing is manual `window.location.pathname` matching in `App.tsx`.
- File/code references in markdown use `[text](path)` links, not backticks.

---

## Current Known Issues / Tech Debt

- **Session ownership checks are partial** — `GET /sessions/{id}` now returns the redacted `_serialize_public()` view (no `conversation_history`) to non-owners of authenticated sessions via `_is_owner_or_admin()` (Phase 10). Anonymous sessions (`user_id=None`) remain a public "unguessable UUID" capability by design. Mutation endpoints already used `_check_session_access`. A full endpoint-by-endpoint audit is still outstanding.
- **Test coverage is partial** — pytest covers `eval_bar.py` and webhook HMAC; vitest covers the pixel kit, episode engine, chat, landing and share helpers/components and the store's evolution triggers; CI runs both plus the frontend build. Ownership checks, most of the store and the backend streams are untested.
- **`backend/llm_client.py` is ~1,550 lines (god-file)** — holds provider clients, streaming, prompt builders, council agents, and synthesis. Should be split into an `llm/` package.
- **Rate limiting is in-memory & per-process** (`RateLimitMiddleware`) — does not work correctly across multiple instances.
- **Admin actions require `ADMIN_EMAILS`** — when Clerk auth isn't configured (pure local dev), every request is treated as admin (open dev mode).
- **STUB_MODE only works for the 3 landing-page example ideas** — any other idea returns a "set your API key" prompt.
- **Anonymous → authenticated session migration** not implemented — sessions started signed-out aren't claimed on sign-in.
- **LangGraph MemorySaver fallback** — when `LANGGRAPH_ENABLED=false`, or when Postgres setup fails, the graph uses `MemorySaver` (in-memory, lost on restart); `/health` reports `langgraph_checkpointer: memory`. `render.yaml` sets `LANGGRAPH_ENABLED=true`. The psycopg pool must use `autocommit=True` + `row_factory=dict_row`: without them `setup()` failed ("CREATE INDEX CONCURRENTLY cannot run inside a transaction block") and production silently ran on memory until Oct 2026.
- **LangGraph Phase 1 only covers the council** — Socratic chat still uses the legacy asyncio pipeline.

---

## Roadmap

### High priority
- **Broaden tests** — ownership checks, the store's stream handling, backend SSE routes (CI already runs pytest + vitest + `npm run build`).
- **Session ownership checks** — full endpoint-by-endpoint audit; `GET /sessions/{id}` is scoped (Phase 10) but other endpoints still need review
- **Hybrid routing** — Sonnet 4.6 for synthesis + verdicts, Haiku 4.5 for chat + agents
- **Analytics** — PostHog or Plausible for conversion funnel visibility
- **Outcome tracking** — "I built it / pivoted / moved on" closes the feedback loop

### Medium priority
- **Split `backend/llm_client.py`** (~1,550 lines) into an `llm/` package (`providers`, `council`, `prompts`)
- **Adopt Alembic for DB migrations** — replace the hand-written `ALTER TABLE ... IF NOT EXISTS` startup stack in `db/database.py`
- **Remove `@ts-ignore`** suppressions on Clerk imports in `LandingPage.tsx` / `SessionPage.tsx`
- **cron-job.org** — daily `POST /admin/send-follow-ups`
- **Custom domain + Resend** — verify domain, update `from` address
- **Socra answers direct questions** — not locked in interrogation-only mode

### Deferred
- **MCP service** — Socra as MCP server (distribution play, premature now)
- **Paid hosting / AWS** — when Render's free-tier cold starts become the actual constraint
