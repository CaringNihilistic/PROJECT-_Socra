# Socra

> An AI startup evaluator that refuses to give a masterplan until it fully understands your idea. It interrogates the founder Socratically, scores the idea across 5 dimensions, then unlocks a multi-agent council analysis + a synthesized "Chairman's Masterplan" + pitch deck. A second mode — the **Tribunal** — puts the idea on trial before 3 adversarial judges who deliver Pass/Fail verdicts.

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
| Cache/queue | Redis (asyncio) | 5.1.0 (provisioned; minimal use) |
| Config | pydantic-settings | 2.5.0 |
| LLM SDKs | anthropic 0.40.0, openai 1.50.0 (also Google Gemini + Groq via HTTP) |
| Observability | langfuse ≥2.0.0 (optional — traces LLM calls) | — |
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
| State | Zustand | 5.0.0 |
| Auth | @clerk/clerk-react | 5.0.0 |
| HTTP | axios | 1.7.0 |
| Markdown | react-markdown 9.0.0 + remark-gfm 4.0.1 |

### Infra
- **Hosting:** Railway (backend + frontend deployed as separate services)
- **Local dev:** Docker Compose (postgres + redis + backend + frontend)

---

## LLM Routing

All LLM calls flow through `backend/llm_client.py`, which routes by priority with automatic fallthrough:

1. **Anthropic Haiku 4.5** (`claude-haiku-4-5-20251001`) — primary
2. **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) — fallback
3. **Groq** (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) — final fallback

`STUB_MODE=true` (or no LLM key set) activates canned demo responses that only work for the **3 example ideas on the landing page**.

Key conventions in the LLM layer:
- The `###JSON###` separator splits streamed text (Part 1, shown to user) from eval JSON (Part 2, parsed by backend).
- Agent/synthesis calls use `_build_agent_msgs` — a single clean user message (idea + founder's answers + web research), **not** the raw Q&A history. Passing Q&A history makes LLMs generate more questions instead of analysis.
- All messages are sanitized to Anthropic's strict validation (no empty `messages[]`, no consecutive same-role, must start with `user`) before any provider call.

---

## Project Structure

```
PROJECT _STARTUP/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting, /health
│   ├── llm_client.py            # LLM routing, council agents, tribunal, masterplan, pitch deck (largest file)
│   ├── observability.py         # Langfuse tracing — set_session_context + record_generation (no-ops if keys unset)
│   ├── eval_bar.py              # 5-dimension scoring + phase thresholds
│   ├── web_search.py            # Tavily live market research
│   ├── core/
│   │   ├── config.py            # Settings (env vars) via pydantic-settings
│   │   └── auth.py              # Clerk JWT verification
│   ├── db/
│   │   ├── database.py          # Async engine + session + init_db
│   │   └── models.py            # Session + WaitlistEntry tables
│   └── api/routes/
│       ├── sessions.py          # CRUD, admin-mark-paid, assumptions, access checks
│       ├── architect.py         # Streaming chat, unlock, masterplan, pitch deck, tribunal, admin seed
│       ├── billing.py           # Razorpay checkout / webhook / verify
│       ├── waitlist.py          # Email waitlist signup
│       ├── followup.py          # Follow-up email capture + admin send
│       └── me.py                # GET /me — current identity + is_admin
├── frontend/
│   └── src/
│       ├── App.tsx              # Routing (path-based), Clerk provider, payment-return handling
│       ├── store/sessionStore.ts # Zustand store — all state + API calls + SSE streaming
│       ├── lib/auth.tsx         # Clerk helpers
│       └── components/          # Pages + views (see below)
├── docker-compose.yml
├── .env.example
└── JOURNEY*.md                  # Build journals (phase-by-phase history)
```

---

## Key Pages & Components (frontend)

Routing is **path-based** in `App.tsx` (no router library) — public share/card/compare routes bypass auth.

| Component | Purpose |
|---|---|
| `LandingPage.tsx` | Entry point — idea input, 3 examples, mode selection (standard vs tribunal) |
| `SessionPage.tsx` | **Standard mode.** 3-page flow via `view` state: **Chat** (Socratic Q&A) → **Council** (5 agent cards + Devil's Advocate) → **Masterplan** (synthesis + pitch deck). Holds `[DEV]` shortcuts. |
| `TribunalPage.tsx` | **Tribunal mode.** Sequential streaming interrogation by 3 judges → Pass/Fail verdicts |
| `PitchDeckView.tsx` | Renders generated pitch deck slides + Devil's Advocate slide |
| `VerdictCard.tsx` / `TribunalCard.tsx` | Tribunal verdict display |
| `CardPage.tsx` | **Public** shareable score card (`/card/:id`) |
| `SharePage.tsx` | **Public** read-only masterplan view (`/share/:id`) |
| `ComparePage.tsx` | **Public** side-by-side comparison of two sessions (`/compare/:id1/:id2`) |
| `EvalBar/EvalBar.tsx` | The 5-dimension progress bar shown during chat |
| `FollowUpEmailCapture.tsx` | Email capture for follow-up nudges |

### Backend Routes
- `POST /sessions/` — create session · `GET /sessions/` — list · `GET /sessions/{id}` — fetch
- `GET /me` — returns `{user_id, email, is_admin}` for the current Clerk token (frontend uses it to show admin shortcuts)
- `POST /sessions/{id}/admin-mark-paid` — **admin bypass** (sets paid + tribunal_paid; requires caller on `ADMIN_EMAILS` allowlist)
- `POST /sessions/{id}/admin-seed-conversation` — **admin**: auto-plays a founder conversation, generates the masterplan, marks paid (quality testing)
- `POST /sessions/{id}/message/stream` — SSE Socratic chat
- `POST /sessions/{id}/unlock` — run council + masterplan (standard mode)
- `POST /sessions/{id}/pitch-deck` — generate pitch deck
- `POST /sessions/{id}/tribunal/message` · `POST /sessions/{id}/tribunal/unlock` — tribunal flow
- `POST /billing/checkout` · `/billing/webhook` · `/billing/verify` — Razorpay
- `POST /waitlist` · `POST /sessions/{id}/follow-up` · `POST /admin/send-follow-ups`
- `GET /health` — checks real DB connection

---

## Council Agents & Tribunal Judges

**Council (standard mode, 5 specialists, run in parallel):**
- 💼 The Banker (finance/unit economics) · 🔮 The Oracle (market/TAM) · ⚔️ The Challenger (competition) · 🔧 The Builder (tech) · 🎯 The Skeptic (risk)
- Then a Devil's Advocate critique + Chairman's Masterplan synthesis.

**Tribunal (3 adversarial judges, sequential, 4 rounds then verdict):**
- 💰 The Investor · 👤 The Customer · ⚔️ The Competitor
- Verdicts use a scoring rubric (65+ = Pass) with cross-pollination (each judge sees the full transcript) and score/pass consistency enforcement.

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

Phase thresholds: `intake` (0.0) → `debate` (0.40) → `stress_test` (0.70) → `masterplan` (0.80). The masterplan is gated behind both reaching the score AND payment.

---

## Environment Variables

### Backend (`.env` / Railway)
| Var | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Primary LLM | "" |
| `GOOGLE_API_KEY` | Gemini fallback | "" |
| `GROQ_API_KEY` | Groq fallback | "" |
| `OPENAI_API_KEY` | (optional) | "" |
| `TAVILY_API_KEY` | Live market research | "" |
| `STUB_MODE` | Offline demo (true = no real LLM) | "true" |
| `DATABASE_URL` | Postgres connection | local docker |
| `REDIS_URL` | Redis connection | local docker |
| `SECRET_KEY` | App secret | dev placeholder |
| `CLERK_SECRET_KEY` | Clerk JWT verification | "" |
| `CLERK_FRONTEND_API_URL` | Clerk issuer (e.g. `https://xxx.clerk.accounts.dev`) | "" |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Payments | "" |
| `RAZORPAY_PRICE_AMOUNT` | Masterplan price in paise | 49900 (₹499) |
| `RAZORPAY_TRIBUNAL_AMOUNT` | Tribunal price in paise | 19900 (₹199) |
| `RESEND_API_KEY` | Follow-up emails | "" |
| `FRONTEND_ORIGIN` | CORS allowed origin | localhost:5173 |
| `ADMIN_EMAILS` | Comma-separated allowlist of admin Clerk emails (or user IDs). Grants payment bypass, skip-to-masterplan, conversation seeding, and view-any-session. Verified via the caller's Clerk token. | "" |
| `ADMIN_SECRET` | Legacy — no longer used for admin gating (kept for back-compat) | "" |
| `LANGFUSE_PUBLIC_KEY` | Langfuse observability — public key (safe to expose) | "" |
| `LANGFUSE_SECRET_KEY` | Langfuse observability — secret key | "" |
| `LANGFUSE_HOST` | Langfuse host (override for self-hosted) | "https://cloud.langfuse.com" |

### Frontend (Vite — must be set at **build time**)
| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_WS_URL` | WebSocket URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key (auth disabled if unset) |
| `VITE_RAZORPAY_KEY_ID` | Controls `BILLING_ENABLED` — when **unset**, `[DEV]` skip-payment buttons appear |
| `VITE_ADMIN_SECRET` | Legacy — no longer used (admin is identity-based via Clerk now) |

---

## How to Run / Build / Deploy

### Local development (Docker Compose — recommended)
```bash
cp .env.example .env        # add ANTHROPIC_API_KEY, set STUB_MODE=false for real responses
docker compose up           # starts postgres, redis, backend (:8000), frontend (:3000)
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
> `npm run build` runs `tsc` first — **unused variables/imports fail the build.** This breaks Railway deploys; keep the TS clean.

### Deploy (Railway)
- Push to `main` → Railway auto-builds both services from their `Dockerfile`s.
- Backend `Dockerfile`: python:3.11-slim, binds `${PORT}`.
- Frontend `Dockerfile`: multi-stage node:20-alpine build, served with `serve` on `${PORT}`. **`VITE_*` vars are baked in at build time** — changing them requires a rebuild, not just a restart.
- Set all backend secrets in the Railway service env. Set `VITE_*` vars on the frontend service.

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
- Tailwind utility classes; accent colors and styling often inline via `style={{}}` with rgba values.
- No router library — routing is manual `window.location.pathname` matching in `App.tsx`.
- File/code references in markdown use `[text](path)` links, not backticks.

---

## Current Known Issues / Tech Debt

- **Stale marketing copy (static page only):** the old static `index.html` still advertises the removed Bull vs Bear debate and HTML pitch export. (`LandingPage.tsx` — the live React landing page — has been cleaned.) Note: the `debate` *scoring phase* (intake → debate → stress_test → masterplan) is unrelated and still live.
- **No session ownership check** on most backend endpoints — any caller with a session ID can read/act on it. Needs an owner check tied to `user_id`.
- **Rate limiting is in-memory & per-process** (`RateLimitMiddleware`) — it does not work correctly across multiple Railway instances.
- **Admin actions require `ADMIN_EMAILS`** — `admin-mark-paid` / `admin-seed-conversation` are gated on the caller's Clerk identity being on the `ADMIN_EMAILS` allowlist. When Clerk auth isn't configured at all (e.g. pure local dev), every request is treated as admin (open dev mode).
- **STUB_MODE only works for the 3 landing-page example ideas** — any other idea in stub mode just returns a "set your API key" prompt.
- **Anonymous → authenticated session migration** is not implemented — sessions started signed-out aren't claimed on sign-in.
- **Payment state is session-scoped in Zustand** — must be reset on session resume/create or the paywall from a previous session leaks through.

---

## Roadmap (from JOURNEY7)

- UI/UX redesign (dark, editorial, premium feel)
- cron-job.org → daily `POST /admin/send-follow-ups`
- Custom domain → verify in Resend → update `from` address
- Socra should answer direct questions (not locked in interrogation-only mode)
- Outcome tracking ("I built it" / "I pivoted" / "I moved on")
- Backend session ownership checks on all endpoints
- Hybrid routing — Sonnet for synthesis + verdicts, Haiku for everything else
- Anthropic `cache_control` on shared prompt prefix
- Analytics (PostHog / Plausible)
