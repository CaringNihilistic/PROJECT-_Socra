# Socra — Build Journal: Phase 3

> Continuing from JOURNEY2.md. Phase 3 covers Google Gemini integration, the Devil's Advocate agent, the Idea Comparison feature, production debugging, and prompt quality fixes.

---

## What We Added This Phase

### 1. Google Gemini 2.0 Flash Integration

Added Google AI Studio as a third LLM provider, slotting between Anthropic and Groq in the routing priority chain. Gemini 2.0 Flash is accessed via Google's OpenAI-compatible endpoint, so no new SDK was needed — just a different base URL and API key.

**New routing priority:**
1. Anthropic Claude Haiku — if `ANTHROPIC_API_KEY` is set
2. **Google Gemini 2.0 Flash** — if `GOOGLE_API_KEY` is set *(new)*
3. Groq LLaMA 3.1 8B / 3.3 70B — if `GROQ_API_KEY` is set
4. Stub mode — demo scenarios

**Why this matters:**
Groq's free tier is 6,000 tokens per minute. A single masterplan pipeline (5 specialist agents + synthesis) consumes 4,000–6,000+ tokens. Any user traffic on top of that caused 429 errors for every call. Google AI Studio's free tier is 1,000,000 tokens per minute — over 150× more headroom. Production was effectively broken on Groq; Google fixed it.

**Implementation:**
```python
async def _call_google(system: str, messages: list[dict], max_tokens: int, json_mode: bool = False) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(
        api_key=settings.google_api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )
    kwargs = {
        "model": "gemini-2.0-flash",
        "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""
```

The same function pattern was added to `_stream_llm_tokens` and `_stream_synthesis_tokens` for streaming support. Both streaming and non-streaming paths needed the `elif settings.google_api_key` branch.

---

### 2. Devil's Advocate Agent

Added a 6th post-synthesis agent that critiques the generated masterplan. Unlike the 5 specialist agents that run in parallel before synthesis, the Devil's Advocate runs *after* the synthesis is complete — so it can critique the actual specific decisions in the masterplan, not generic startup concerns.

**Why post-synthesis matters:**
The 5 specialist agents analyze the conversation and idea in isolation. But the masterplan itself might make specific tool choices, timelines, or risk mitigations that deserve direct criticism. The Devil's Advocate has the full synthesized plan in its context and is instructed to reference specific claims from it.

**Output:**
```
1. The Phase 1 timeline of 4 weeks for X is unrealistic because...
2. Choosing PostgreSQL as the primary store for [specific use case] will break at...
3. The risk mitigation of "use Clerk for SSO" assumes enterprise budgets, but...
```

**Implementation notes:**
- Uses synthesis-quality model (not the fast/cheap specialist model): `claude-haiku`, `gemini-2.0-flash`, or `llama-3.3-70b-versatile` (Groq)
- Wrapped in `try/except` in the SSE stream so a failure here doesn't kill the whole pipeline
- Prompt language softened to pass Google's safety filters (removed "brutal", "destroy", "merciless" — replaced with "critical reviewer", "stress-testing")

```python
async def run_devils_advocate(masterplan: str, conversation_history: list[dict]) -> dict:
    excerpt = masterplan[:2500]
    system = f"""You are a critical reviewer stress-testing a startup masterplan.
MASTERPLAN TO REVIEW:
{excerpt}
Write exactly 5 numbered critiques of this specific plan..."""
    # Routes to Anthropic → Google → Groq (versatile model, not 8B)
    ...
    return {"key": "devils_advocate", "title": "Devil's Advocate", "icon": "💀", ...}
```

---

### 3. Idea Comparison Feature

Built a full side-by-side comparison flow for two completed sessions.

**User flow:**
1. On SessionPage (masterplan view): click **"↔ Compare"** → navigates to `/?compare={sessionId}`
2. On LandingPage: session history cards show "↔" button; clicking one selects it (amber border + hint text)
3. Clicking a second session navigates to `/compare/{id1}/{id2}`
4. ComparePage fetches both sessions and renders them side-by-side

**Three files changed:**

**App.tsx** — added route detection before the main render:
```typescript
const compareMatch = window.location.pathname.match(/^\/compare\/([^/]+)\/([^/]+)$/)
const COMPARE_IDS = compareMatch ? [compareMatch[1], compareMatch[2]] as const : null

// In App():
if (COMPARE_IDS) {
  return <ComparePage id1={COMPARE_IDS[0]} id2={COMPARE_IDS[1]} />
}
```

**LandingPage.tsx** — compare selection state:
```typescript
const [compareId, setCompareId] = useState<string | null>(() => {
  const p = new URLSearchParams(window.location.search)
  return p.get('compare')  // Pre-select if navigating back from SessionPage
})

const handleCompareClick = (id: string) => {
  if (compareId === id) { setCompareId(null) }  // Deselect
  else if (compareId) { window.location.href = `/compare/${compareId}/${id}` }  // Navigate
  else { setCompareId(id) }  // First selection
}
```

**SessionPage.tsx** — compare button in masterplan header:
```tsx
<a href={`/?compare=${session.id}`} className="...">↔ Compare</a>
```

**ComparePage.tsx** — pre-existing from a prior sketch, but fixed a TypeScript build error (see Bugs section below).

---

### 4. Token Limit Increases for Specialist Agents

The specialist agents were outputting truncated analyses because the token caps were too low. Increased limits:

| Path | Before | After |
|------|--------|-------|
| Anthropic `_call_fast_llm` | 400 | 900 |
| Google `_call_fast_llm` | 600 | 900 |
| Groq `_call_fast_llm` | 250 | 400 |

The Groq limit stayed lower to stay within TPM budget on the free tier.

---

### 5. Synthesis Prompt: Template Bleeding Fix

The synthesis model was copying mitigations from the format examples embedded in its prompt and applying them to unrelated ideas. A cattle farming idea was getting Stripe Connect escrow and 1099-NEC mitigations — because those examples appeared in the ML marketplace demo scenario embedded in the prompt.

**Fix:** Added explicit guards:
```
NOTE: The examples above are FORMAT EXAMPLES ONLY. Do not copy "Stripe Connect escrow", 
"1099-NEC", "Upwork/Toptal/Scale AI" or any other example content unless it is genuinely 
relevant to THIS specific idea.

FORBIDDEN: copying risk mitigations from examples that don't apply (e.g. contractor 
payment escrow for a non-marketplace product)
```

---

### 6. Production Debugging: Environment Variable Pickup

The production Railway deployment was routing all LLM calls to Groq despite `GOOGLE_API_KEY` being set in Railway's Variables tab. Debugging revealed multiple layers:

**Layer 1: Wrong startup log order**
`main.py` checked Anthropic → Groq but never Google. So even if Google was set, the log said "Using Groq" and the startup check was misleading. Fixed by adding the Google branch before Groq.

**Layer 2: Container wasn't restarted**
Railway sometimes doesn't auto-redeploy when an env var is added via the Variables tab. A new code push (which triggers a fresh build + deploy) is needed to guarantee the new variable is picked up.

**Layer 3: Debugging visibility**
Added explicit env var logging at startup and debug fields to the `/health` endpoint:
```python
_raw_google = os.environ.get("GOOGLE_API_KEY", "")
print(f"🔑 ENV check — GOOGLE_API_KEY: {'SET(' + str(len(_raw_google)) + ' chars)' if _raw_google else 'EMPTY'}")
```

```json
// /health response
{
  "llm": "google",
  "env_google_key_set": true,
  "settings_google_key_set": true
}
```

---

## Bugs Fixed

### 1. TypeScript build error: unused variable in ComparePage.tsx
**Error:** `'keyName' is declared but its value is never read (TS6133)` at line 19  
**Cause:** A destructured prop `keyName` existed only for type-checking, not for use in the component.  
**Fix:** Renamed to `_keyName` (TypeScript convention for intentionally unused destructured variables):
```typescript
function AgentPairRow({ keyName: _keyName, r1, r2 }: { keyName: string; ... }) {
```

### 2. Devil's Advocate showing wrong content
**Cause:** `run_devils_advocate` was routing to `_call_fast_llm` (the 8B model with 400 tokens) — too small to produce useful critiques, and often cut off mid-sentence.  
**Fix:** Gave it its own routing block that uses the synthesis-quality model (same tier as the masterplan writer).

### 3. Google safety filter rejecting Devil's Advocate prompt
**Cause:** Prompt contained "brutal", "mercilessly", "destroy the plan" — Google's content safety filters rejected these.  
**Fix:** Softened to "critical reviewer", "stress-testing", "direct and honest". Output quality unchanged; the numbered format instructions already force specificity.

### 4. LandingPage TypeScript errors on hover handlers
**Cause:** `onMouseEnter` / `onMouseLeave` event handlers had implicit `any` typed parameters (`e`) which TypeScript's strict mode rejects.  
**Fix:** Removed event handlers entirely, replaced hover styling with Tailwind `hover:` utility classes. No behavior change.

### 5. Startup log lying about which LLM is active
**Cause:** `main.py` lifespan checked `elif settings.anthropic_api_key` → `elif settings.groq_api_key`, skipping Google entirely. If both Groq and Google keys were set, it always said "Using Groq."  
**Fix:** Added `elif settings.google_api_key` between Anthropic and Groq checks.

### 6. Masterplan risk register copying wrong mitigations
**Cause:** Format examples in the synthesis prompt (showing Stripe Connect escrow, 1099-NEC) were being copied verbatim into unrelated ideas.  
**Fix:** Added `NOTE: The examples above are FORMAT EXAMPLES ONLY` and explicit `FORBIDDEN` rule in the synthesis prompt.

---

## Architecture After Phase 3

```
Browser
  └── React frontend (Vite + Zustand)
        ├── token events → streams AI text word-by-word
        ├── choices event → renders 3-4 clickable reply pills
        ├── agent_report events → renders 5 specialist cards + Devil's Advocate
        ├── synthesis_token events → streams final masterplan
        └── done event → final session state update

FastAPI backend
  ├── POST /sessions/                     — create session + first LLM turn
  ├── POST /sessions/{id}/message/stream  — SSE: conversation → agents → synthesis → devil
  ├── GET  /sessions/                     — list sessions (auth required)
  ├── GET  /sessions/{id}                 — fetch single session
  ├── POST /waitlist                      — email signup
  └── GET  /health                        — status + LLM routing debug info

LLM routing (Google path — production default):
  ├── Conversation: gemini-2.0-flash (stream with ###JSON### separator)
  ├── Specialist agents: gemini-2.0-flash × 5 (parallel, 900 tokens each)
  ├── Synthesis: gemini-2.0-flash (streamed, 3000 tokens)
  └── Devil's Advocate: gemini-2.0-flash (non-streaming, 800 tokens)

LLM routing (Groq path — fallback):
  ├── Conversation: llama-3.1-8b-instant (stream) + JSON-mode eval call (separate)
  ├── Specialist agents: single combined call → llama-3.1-8b-instant (1800 tokens total)
  ├── Synthesis: llama-3.3-70b-versatile (streamed, 3000 tokens)
  └── Devil's Advocate: llama-3.3-70b-versatile (non-streaming, 800 tokens)

Frontend routing (no react-router):
  ├── /compare/{id1}/{id2}  → ComparePage
  ├── /session/{id}         → SessionPage
  └── /                     → LandingPage (with optional ?compare= param)
```

---

## SSE Event Order (Full Pipeline)

```
POST /sessions/{id}/message/stream
  │
  ├── {type: "token", delta: "..."}          × N  — conversation response streaming
  ├── {type: "choices", choices: [...]}            — reply options (if not masterplan phase)
  ├── {type: "result", data: {eval_delta...}}      — score update
  │
  │  (if phase becomes "masterplan")
  ├── {type: "agent_report", report: {finance}}    — specialist 1 done
  ├── {type: "agent_report", report: {market}}     — specialist 2 done
  ├── {type: "agent_report", report: {competition}}— specialist 3 done
  ├── {type: "agent_report", report: {tech}}       — specialist 4 done
  ├── {type: "agent_report", report: {risk}}       — specialist 5 done
  ├── {type: "synthesis_token", delta: "..."}      × N  — masterplan streaming
  ├── {type: "synthesis_done", text: "..."}        — full masterplan text
  ├── {type: "agent_report", report: {devils_advocate}}  — critique (post-synthesis)
  └── {type: "done", session: {...}}               — final DB-saved state
```

---

## Concepts Learned This Phase

### OpenAI-compatible endpoints
Several LLM providers (Google AI Studio, Groq, Azure OpenAI) expose an API that matches OpenAI's exact request/response format. This means you can use the `openai` Python SDK with just a different `base_url` and `api_key` — no new SDK needed. Google's endpoint is:
```
https://generativelanguage.googleapis.com/v1beta/openai/
```

### Railway env var pickup requires redeploy
Adding or changing a variable in Railway's Variables tab does NOT automatically restart the service. The change is applied on the next deploy. If you need it to take effect immediately, you must trigger a manual redeploy (or push new code, which triggers a build + deploy automatically).

### Prompt safety filters differ by provider
Google's Gemini has stricter content safety filtering than Groq or Anthropic for adversarial prompt language. Words like "brutal", "destroy", "merciless" in a system prompt get the request blocked — even in a clearly professional/analytical context. The fix: describe the role in neutral terms ("critical reviewer") and rely on output format instructions (numbered list, reference specific claims) to get the same analytical depth.

### TypeScript convention for unused destructured props
When a destructured prop is needed for type checking but not used in the function body, prefix it with `_`:
```typescript
function Row({ keyName: _keyName, r1, r2 }: Props) {
  // _keyName exists in Props type, enforced by TS, but not used here
}
```
This silences the `TS6133 declared but never read` error without disabling the check globally.

### LLM model tier decisions
Not all tasks need the same model size:
- **Conversation (streaming):** Needs to be fast and cheap. 8B models work if prompts are simple.
- **Specialist analysis:** Needs factual accuracy and domain knowledge. 8B works for structured JSON output with a clear schema; larger is better for free-form analysis.
- **Synthesis:** Needs to write coherent long-form markdown. Use the biggest/best model available.
- **Post-synthesis critique:** Same as synthesis — it needs to read and reason about a 2000-word document.

Using the wrong tier at the wrong stage is a common mistake. The Devil's Advocate was initially wired to the 8B fast model (wrong tier), producing useless one-liner outputs.

---

## Key Files Changed This Phase

| File | What Changed |
|------|-------------|
| `backend/llm_client.py` | Google `_call_google` + streaming, routing in all LLM calls, Devil's Advocate agent, synthesis prompt template bleed fix, token limit increases |
| `backend/main.py` | Google in startup log check, debug env var logging, `/health` LLM debug fields |
| `backend/core/config.py` | `google_api_key` field, `.strip()` on all keys |
| `docker-compose.yml` | `GOOGLE_API_KEY` env var passed to backend service |
| `frontend/src/App.tsx` | `/compare/{id1}/{id2}` route detection, `ComparePage` render |
| `frontend/src/components/LandingPage.tsx` | Compare flow state + handler, "↔" button on session cards, amber selection UI |
| `frontend/src/components/SessionPage.tsx` | "↔ Compare" link in masterplan header |
| `frontend/src/components/ComparePage.tsx` | Fixed `_keyName` TypeScript build error |

---

## What's Next

| Priority | Task |
|----------|------|
| High | Verify `/health` endpoint shows `"llm": "google"` on production after Railway redeploy |
| High | Web scraping agents — integrate Tavily API for real market/competitor data in specialist agents |
| High | Pitch deck output — generate investor-ready slide content as main deliverable |
| Medium | AI debate mode — let two AI personas argue opposing positions on the same idea |
| Medium | Better LLM options — route to Claude Sonnet / GPT-4o for users willing to provide keys |
| Medium | "Re-run analysis" button if agents show rate limit errors |
| Low | Share button for masterplan (public URL, no auth required to view) |
| Low | Remove debug env logging from `/health` once production is confirmed stable |
