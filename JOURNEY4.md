# Socra — Build Journal: Phase 4

> Continuing from JOURNEY3.md. Phase 4 covers web research agents, investor pitch deck, AI debate mode, landing page refresh, and completing the Clerk auth integration.

---

## What We Added This Phase

### 1. Web Research Agents (Tavily Integration)

Added real web search to the specialist agent pipeline. Before Phase 4, all five specialist agents wrote their reports purely from the conversation history — market sizes, competitor names, and pricing benchmarks were hallucinated. Now, two parallel Tavily searches run before the agents start, and the results are injected into every agent's context.

**How it works:**
```
User sends message → score hits masterplan threshold
  → gather_web_context() [2 parallel Tavily searches]
  → yield {type: "web_research"} SSE event (triggers "Searching the web…" UI)
  → run 5 specialist agents in parallel, each receiving web context
  → synthesis → devil's advocate → done
```

**New file: `backend/web_search.py`**
```python
async def _tavily_search(query: str, max_results: int = 3) -> list[dict]:
    """Single Tavily search call. Returns [] on any error."""
    if not settings.tavily_api_key:
        return []
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.tavily.com/search",
            json={"api_key": settings.tavily_api_key, "query": query, "max_results": max_results},
        )
        return r.json().get("results", [])

async def gather_web_context(conversation_history: list[dict]) -> tuple[str, list]:
    """Runs 2 searches from the idea, returns markdown-formatted context string."""
    idea = next((m["content"] for m in conversation_history if m["role"] == "user"), "")
    queries = [f"{idea[:120]} market size competitors", f"{idea[:120]} pricing revenue model"]
    results_list = await asyncio.gather(*[_tavily_search(q) for q in queries])
    # Format into markdown snippets injected into agent system prompts
```

**Graceful degradation:** If `TAVILY_API_KEY` is not set, `gather_web_context` returns `("", [])` and the pipeline runs as before — no errors, just no web context. Tavily is entirely optional.

**Why 2 searches (not 5):** Tavily's free tier is 1,000 searches/month. Running 5 searches per masterplan session at even modest usage would exhaust that quickly. Two searches — one for market/competitors, one for pricing/revenue — cover the most hallucination-prone categories.

**`web_research` SSE event:**
```json
{"type": "web_research"}
```
Frontend sets `isResearching: true` on this event, renders a pulsing "Searching the web…" indicator before the agent cards appear. Cleared when the first `agent_report` event arrives.

---

### 2. Investor Pitch Deck

Added a 9-slide pitch deck generated from the masterplan, with two outputs: in-app slide cards and an LLM-generated interactive HTML export.

**Slide structure:**
| Slide | Title |
|-------|-------|
| 01 | The Problem |
| 02 | Our Solution |
| 03 | Market Opportunity |
| 04 | How It Works |
| 05 | Business Model |
| 06 | Competitive Advantage |
| 07 | Traction & Milestones |
| 08 | The Team |
| 09 | The Ask |

**Backend — `generate_pitch_deck()`:**
Single LLM call with the full conversation history + all 5 agent reports + masterplan as context. Returns a JSON object with a `slides` array. Each slide has `id`, `title`, `headline`, and `bullets`. Cached in the DB `pitch_deck` JSONB column on first generation.

```python
async def generate_pitch_deck(conversation_history, agent_reports, masterplan) -> dict:
    system = """You are a pitch deck writer for a VC audience...
    Return ONLY valid JSON: {"slides": [{"id": "problem", "title": "...", "headline": "...", "bullets": ["..."]}]}"""
    # 9 slides returned as structured JSON
```

**Backend — `generate_pitch_deck_html()`:**
A second LLM call that takes the structured deck JSON and generates a complete interactive HTML file. The model writes the full HTML with keyboard navigation, touch swipe, fullscreen toggle, progress bar, and slide transitions. Max tokens: 5,000 (needed for a full HTML document).

```python
async def generate_pitch_deck_html(deck: dict, devil_content: str, idea: str) -> str:
    # LLM generates a complete self-contained HTML file
    # devil_content (from devil's advocate agent) appears as a final "risks" slide
```

**Why delegate HTML generation to the LLM:** The alternative — writing a static HTML template — would produce a generic, low-quality output. Claude/Gemini can generate a beautifully styled, fully interactive presentation with zero template maintenance. The result is unique to each idea, not a filled-in template.

**New endpoints:**
- `POST /sessions/{id}/pitch-deck` — generates and caches; returns cached result if called again
- `POST /sessions/{id}/pitch-deck/html` — generates interactive HTML, served as `Content-Disposition: attachment`

**Frontend — `PitchDeckView.tsx`:**
- `SlideCard`: color-coded card per slide with top border accent, slide number, headline, and bullet list
- `DevilSlideCard`: red-accented final slide showing devil's advocate content
- "Export as HTML" button calls `POST /sessions/{id}/pitch-deck/html`, receives the HTML file, triggers browser download
- `SLIDE_ACCENTS` map: per-slide custom border/label color so each slide is visually distinct

**UX flow:** "⬡ Pitch Deck" button in masterplan header. First click generates (shows "..."). Subsequent clicks toggle the panel. Already-generated deck is returned instantly from cache.

---

### 3. AI Debate Mode

Added a structured Bull vs Bear debate across 3 rounds, ending with a verdict. Useful for founders deciding between two approaches or wanting to pressure-test a commitment.

**Debate structure:**
```json
{
  "topic": "Is this the right time to build X?",
  "rounds": [
    {"round": 1, "label": "Opening Arguments", "bull": "...", "bear": "..."},
    {"round": 2, "label": "Rebuttals",          "bull": "...", "bear": "..."},
    {"round": 3, "label": "Closing Statements", "bull": "...", "bear": "..."}
  ],
  "verdict": "..."
}
```

**Bull persona:** VC optimist — focuses on market timing, tailwinds, and the best-case outcome.  
**Bear persona:** Operator skeptic — focuses on unit economics, execution risk, and what has failed before in this space.

**Backend — `generate_debate()`:**
Single LLM call returning the full debate as a JSON object. Cached in the DB `debate` JSONB column. Returns cached result if called again.

```python
system = """You are moderating a structured startup debate.
Bull: A VC optimist who believes market timing is everything.
Bear: An operator skeptic who has seen the execution reality.
Run exactly 3 rounds then give a balanced verdict.
Return ONLY valid JSON: {"topic": "...", "rounds": [...], "verdict": "..."}"""
```

**New endpoint:**
- `POST /sessions/{id}/debate` — generates and caches; returns cached result if called again

**Frontend — `DebateView.tsx`:**
- Phase tabs at top (Round 1 / Round 2 / Round 3 label)
- Each round: side-by-side grid — Bull card (emerald border/bg) left, Bear card (red border/bg) right
- Verdict section at bottom with indigo styling
- Full component fades in with `fade-up` animation class

**UX flow:** "⚔ Debate" button in masterplan header alongside Share, Compare, Export, and Pitch Deck. Same toggle/cache pattern as pitch deck.

---

### 4. DB Migrations (Idempotent)

Two new columns added to the sessions table. Both were added via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `init_db()` — so existing Railway deployments pick them up on next startup without needing a migration tool.

```python
await conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pitch_deck JSONB"))
await conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS debate JSONB"))
```

Both columns are also declared in `db/models.py`:
```python
pitch_deck = Column(JSON, nullable=True)
debate     = Column(JSON, nullable=True)
```

And included in `_serialize()` in `sessions.py` so they're returned in every session response.

---

### 5. Landing Page Refresh

The landing page described the original 3-feature version of Socra. After Phase 4, the app has 9+ distinct outputs. Two areas were updated:

**Features grid (6 → 9 cards):**

| Old | New |
|-----|-----|
| Debate Engine (vague) | Live Evaluation Bar (specific) |
| Evaluation Bar | Assumption Tracker |
| Assumption Tracker | 5 Specialist Agents |
| Cross-session Memory (not built) | Web Research (Tavily) |
| Architecture Diagram (not built) | Devil's Advocate |
| "What Could Go Wrong" (vague) | Investor Pitch Deck |
| | AI Debate Mode |
| | Idea Comparison |
| | Architecture Masterplan |

Old cards described planned/hypothetical features. New cards describe what's actually in the product, with specific detail ("9 slide-ready cards... Export as interactive HTML").

**LiveDemo — 4-phase animated showcase (28-second loop):**

The original demo was a single 17-second loop showing only the eval bar filling and a conversation. Replaced with a 4-phase cycle:

| Phase | Duration | What it shows |
|-------|----------|---------------|
| ① Eval | 0–9s | 5-dimension score bars filling + Socra conversation with a challenge |
| ② Agents | 9–15s | "Searching the web…" pulse → 3 specialist agent cards appearing |
| ③ Pitch | 15–21s | Slide 01/09 card (The Problem) with headline, bullets, dot navigation |
| ④ Debate | 21–28s | Bull and Bear cards fade in → indigo verdict appears |

Phase tabs in the title bar highlight the active phase so visitors always know what they're watching. The animation uses the same `useState` + `setTimeout` pattern as before, extended to a `DemoPhase` discriminated union driving which JSX block renders.

```typescript
type DemoPhase = 'eval' | 'agents' | 'pitch' | 'debate'

interface DemoState {
  phase: DemoPhase
  // eval state
  dims: Dims; total: number; showMsg: boolean; showChallenge: boolean
  // agents state
  searching: boolean; agentCount: number
  // debate state
  showBull: boolean; showBear: boolean; showVerdict: boolean
}
```

---

### 6. Auth: Completing the Clerk Integration

Clerk was partially wired in Phase 2/3. Phase 4 completed the remaining gaps.

**What was already working:**
- `ClerkProvider` wrapping the app in `App.tsx`
- `ClerkSync` component syncing JWT to the Zustand store on sign-in
- `authToken` in store, `authHeaders()` helper passed to all API calls
- Backend JWT verification via JWKS in `core/auth.py`
- `user_id` column on sessions, `GET /sessions/` filters by user
- Clerk keys configured in `.env` and docker-compose

**What was missing:**

**Token expiry** — Clerk JWTs expire in 1 hour. `ClerkSync` called `getToken()` once on sign-in and cached the result in the store. Long sessions would silently lose auth after 1 hour. Fixed with a 45-minute interval:

```typescript
function ClerkSync() {
  const { getToken, isSignedIn } = useAuth()
  const setAuthToken = useSessionStore((s) => s.setAuthToken)

  useEffect(() => {
    if (!isSignedIn) { setAuthToken(null); return }

    const refresh = async () => setAuthToken(await getToken())
    refresh()
    loadSessionHistory()

    const interval = setInterval(refresh, 45 * 60 * 1000)  // 45 min
    return () => clearInterval(interval)
  }, [isSignedIn])
}
```

**`resumeSession` missing auth headers** — All other store actions passed auth headers, but `resumeSession` used a bare `axios.get`. Made consistent:
```typescript
const { data } = await axios.get(`${API_URL}/sessions/${sessionId}`, {
  headers: authHeaders(authToken),
})
```

**No auth UI in SessionPage** — Once a user entered a session there was no visible sign-in option and no indication their work wasn't being saved. Added two components:

`SessionAuthButton` — renders in the session header next to "← new". Shows Clerk's `<UserButton>` (avatar + menu) when signed in, or a small "Sign in" button when not.

`SaveNudge` — amber banner below the eval bar, only visible to anonymous users:
```
⚠ This session isn't saved to an account — sign in to keep your work across devices →
```
Clicking it opens the Clerk sign-in modal. Hidden entirely when signed in or when Clerk is not configured.

**Railway env vars required (manual step):**
| Service | Variable | Value |
|---------|----------|-------|
| Frontend | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| Backend | `CLERK_SECRET_KEY` | `sk_test_...` |
| Backend | `CLERK_FRONTEND_API_URL` | `https://precious-starling-67.clerk.accounts.dev` |

---

## Bugs Fixed

### 1. Google → Groq fallback missing across all LLM paths
**Cause:** When the Google AI Studio daily quota (1,500 RPD) was exhausted, calls threw a `429` exception. The original code had no fallback — the exception propagated to the user as an HTTP 503.  
**Fix:** Added try/except around every Google call in `llm_client.py`, falling through to the Groq path on any exception. All 6 LLM call paths were updated: `_call_real_llm`, `_call_fast_llm`, `_stream_llm_tokens`, `_stream_synthesis_tokens`, `run_devils_advocate`, `stream_architect_llm`.

### 2. Missing choices after fallback to Groq
**Cause:** `stream_architect_llm` expected responses in `message_text + ###JSON### + json_block` format. When Groq 8B was used as fallback (after Google failed), it produced plain prose without the `###JSON###` separator. The `split("###JSON###")` returned only one element, the JSON parse failed, and `_default_result` was used — which has `choices: []`.  
**Fix:** When the separator is not found, a second Groq JSON-mode call runs to recover `choices` and `eval_delta` from the plain text response. Choices appear correctly regardless of which model handled the stream.

### 3. Pitch deck HTML returning empty string
**Cause:** The HTML generation call used `max_tokens=3000`. A full interactive HTML file with keyboard nav, touch swipe, and transitions requires 4,000–5,000 tokens. The output was silently truncated, ending mid-tag, and the frontend received broken HTML.  
**Fix:** Increased to `max_tokens=5000`. Also added a guard in the endpoint:
```python
if not html:
    raise HTTPException(503, "HTML generation failed — try again")
```

### 4. Debate JSON parsing failure
**Cause:** LLM occasionally wrapped the JSON in a markdown code block (` ```json ... ``` `). `json.loads()` on the raw string failed.  
**Fix:** Strip code fences before parsing:
```python
text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
```

---

## Architecture After Phase 4

```
Browser
  └── React frontend (Vite + Zustand + Clerk)
        ├── ClerkProvider → ClerkSync (JWT refresh every 45 min)
        ├── token/synthesis_token events → streaming text
        ├── web_research event → "Searching the web…" indicator
        ├── agent_report events → specialist cards + devil's advocate
        ├── choices event → quick reply pills
        └── done event → final session state

FastAPI backend
  ├── POST /sessions/                         — create + first LLM turn
  ├── POST /sessions/{id}/message/stream      — full SSE pipeline
  ├── PATCH /sessions/{id}/assumptions        — assumption status update
  ├── GET  /sessions/                         — list (requires Clerk JWT)
  ├── GET  /sessions/{id}                     — fetch session
  ├── POST /sessions/{id}/pitch-deck          — generate + cache pitch deck JSON
  ├── POST /sessions/{id}/pitch-deck/html     — generate interactive HTML export
  ├── POST /sessions/{id}/debate              — generate + cache Bull vs Bear debate
  └── GET  /health

Masterplan SSE event order:
  token × N
  → web_research
  → agent_report × 5 (market, system, risk, finance, growth)
  → synthesis_token × N
  → synthesis_done
  → agent_report (devils_advocate)
  → choices (if not masterplan phase)
  → done

LLM routing (priority order):
  1. Anthropic Claude Haiku     — if ANTHROPIC_API_KEY set
  2. Google Gemini 2.0 Flash    — if GOOGLE_API_KEY set
  3. Groq LLaMA 3.1 8B / 3.3 70B — if GROQ_API_KEY set
  4. Stub mode                  — demo only

Session persistence:
  - Anonymous users → localStorage (device-local, up to 10 sessions)
  - Authenticated users → PostgreSQL (cross-device, unlimited, filtered by user_id)
  - Clerk JWT verified via JWKS on every authenticated request
```

---

## SSE Event Order (Complete Reference)

```
POST /sessions/{id}/message/stream
  │
  ├── {type: "token", delta: "..."}           × N   — conversation streaming
  │
  │  (if phase becomes "masterplan")
  ├── {type: "web_research"}                        — Tavily searches running
  ├── {type: "agent_report", report: {...}}    × 5  — specialist cards
  ├── {type: "synthesis_token", delta: "..."}  × N  — masterplan streaming
  ├── {type: "synthesis_done", text: "..."}         — masterplan complete
  ├── {type: "agent_report", report: {devils_advocate}} — critique
  │
  ├── {type: "choices", choices: [...]}              — reply pills (non-masterplan only)
  └── {type: "done", session: {...}, refusal: null}  — final DB state

Follow-up mode (masterplan already exists):
  ├── {type: "token", delta: "..."}  × N
  └── {type: "done", session: {...}}
```

---

## Key Files Changed This Phase

| File | What Changed |
|------|-------------|
| `backend/web_search.py` | New file: Tavily search, `gather_web_context()` |
| `backend/core/config.py` | `tavily_api_key` field + `.strip()` |
| `backend/llm_client.py` | `generate_pitch_deck()`, `generate_pitch_deck_html()`, `generate_debate()`, Google→Groq fallback in all 6 LLM paths, separator-not-found Groq recovery, web context injection into agents |
| `backend/api/routes/architect.py` | `POST /pitch-deck`, `POST /pitch-deck/html`, `POST /debate` endpoints |
| `backend/api/routes/sessions.py` | `pitch_deck` and `debate` in `_serialize()` |
| `backend/db/models.py` | `pitch_deck` and `debate` JSONB columns |
| `backend/db/database.py` | `ADD COLUMN IF NOT EXISTS` migrations for both columns |
| `docker-compose.yml` | `TAVILY_API_KEY` env var |
| `frontend/src/store/sessionStore.ts` | `DebateRound`, `Debate`, `PitchSlide`, `PitchDeck` types; `generatePitchDeck()`, `generateDebate()` actions; `isResearching` state; `resumeSession` auth headers |
| `frontend/src/components/PitchDeckView.tsx` | New file: `SlideCard`, `DevilSlideCard`, `PitchDeckView` |
| `frontend/src/components/DebateView.tsx` | New file: Bull vs Bear round cards + verdict |
| `frontend/src/components/SessionPage.tsx` | Web research indicator, pitch deck toggle + render, debate toggle + render, `SessionAuthButton`, `SaveNudge` |
| `frontend/src/components/LandingPage.tsx` | 9-card feature grid, 4-phase animated demo, updated proof row + ticker + "With Socra" bullets |
| `frontend/src/App.tsx` | `ClerkSync` 45-min token refresh interval |

---

## Concepts Learned This Phase

### Graceful degradation as a design principle
Every new integration in Phase 4 was built to fail silently: Tavily returns empty string, pitch deck HTML returns 503 instead of broken HTML, Google falls through to Groq. The app never crashes on a missing API key or quota exhaustion — it degrades to a still-functional state.

### LLM-generated HTML as an output format
Instead of building a slide deck renderer in React, we delegated the entire HTML file to the LLM. This produces genuinely beautiful, interactive output without any template maintenance — the model writes keyboard navigation, touch handling, animations, and slide styling from scratch. The tradeoff is token cost (~4,000 tokens per export) and occasional truncation if the token limit is too low.

### Clerk JWT expiry is silent by default
Clerk tokens expire in 1 hour. If you cache the token in a store at sign-in and never refresh it, authenticated API calls start returning 401 silently after 1 hour — the user appears signed in (Clerk session is still valid client-side) but their API calls fail. The fix is periodic `getToken()` calls, which Clerk handles correctly by refreshing the underlying token when near expiry.

### Idempotent DB migrations with `IF NOT EXISTS`
For a small-team product on Railway, running a full migration tool (Alembic) for every column addition is friction without much benefit. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe to call on every startup — it no-ops if the column already exists and adds it if not. Works for additive changes (new columns). Not suitable for renaming, type changes, or constraint modifications.

### SSE event types as a protocol
The streaming pipeline is effectively a mini protocol: `token` → `web_research` → `agent_report` → `synthesis_token` → `done`. Each event type triggers specific UI state transitions. Adding the `web_research` event required updating both the backend generator and the frontend store to handle the new type without breaking existing event processing.

---

## What's Next

| Priority | Task |
|----------|------|
| High | Add `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_FRONTEND_API_URL` to Railway for production auth |
| High | Add `TAVILY_API_KEY` to Railway for web research in production |
| Medium | Session history sidebar — slide-out panel from SessionPage showing past sessions |
| Medium | Anonymous → authenticated session migration — when user signs in, link their localStorage sessions to their new account |
| Medium | Backend session ownership check — `GET /sessions/{id}` and message endpoints should verify the requesting user owns the session |
| Medium | PDF/print export — full masterplan + agent reports as a formatted PDF |
| Low | Test Gemini quota reset — verify Google path works end-to-end after quota refills |
| Low | Landing page — add more specific social proof / example outputs |
