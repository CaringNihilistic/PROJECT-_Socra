# Socra — Build Journal: Phase 2

> Continuing from JOURNEY.md. Phase 2 covers UI/UX overhaul, multi-agent masterplan pipeline, model switching, and conversation quality fixes.

---

## What We Added This Phase

### 1. Multi-Agent Masterplan Pipeline

Instead of a single LLM generating the masterplan, we now run **5 specialist agents** in sequence. Each agent focuses on a specific domain, returns a report card, and then a synthesis agent writes the final masterplan using those findings.

**Agents:**
| Agent | Focus | Color |
|-------|-------|-------|
| 💰 Financial Analysis | Revenue model, unit economics, burn rate | Emerald |
| 📈 Market Analysis | TAM/SAM, GTM, customer segments | Blue |
| ⚔️ Competitive Landscape | Named competitors, moats, differentiation | Amber |
| ⚙️ Technical Assessment | Architecture risks, build vs buy, scale breaks | Cyan |
| ⚠️ Risk & Scalability | Failure modes, regulatory exposure, critical assumptions | Orange |

**How it streams:**
1. Session score crosses 80% → masterplan phase triggered
2. Each agent runs and yields its report card as it finishes → card appears in UI immediately
3. After all 5 agents, the synthesis agent streams the final masterplan token by token

### 2. Model Switch: 70B → 8B Instant

Switched the main conversation model from `llama-3.3-70b-versatile` (100k tokens/day) to `llama-3.1-8b-instant` (500k tokens/day) to avoid hitting Groq's free-tier daily limit. The synthesis agent kept `llama-3.3-70b-versatile` since masterplan quality matters most there.

### 3. Two-Call Approach for Groq 8B

The 8B model doesn't reliably output a `###JSON###` separator in a single streaming response, so the original approach of embedding structured data in the stream broke every turn after the first.

**Old approach (broke with 8B):**
```
Stream: "Here are my questions... ###JSON###{"eval_delta": {...}, "choices": [...]}"
```

**New two-call approach:**
- **Call 1**: Stream plain text with no format requirements → yields `token` events to the frontend
- **Call 2**: After streaming ends, make a separate non-streaming JSON-mode call to Groq to get `eval_delta`, `new_assumptions`, and `choices`

Anthropic path still uses the `###JSON###` separator since Claude follows format instructions reliably.

### 4. Quick Reply Choices Fixed

After the model switch, the 3-4 clickable reply choices stopped appearing after the first response. Root cause: the eval model was setting `phase: "masterplan"` prematurely after 2 turns (because it computed current_score + delta and crossed 0.85), which caused `choices: []`.

**Fixes:**
- Removed `phase` from the eval model's output — the server already computes phase correctly from score math, the model's guess was wrong
- Eval prompt now always requires 3-4 choices with no "empty if masterplan" escape hatch
- Server gates choices with `new_phase != "masterplan"` so choices only disappear when the server-computed phase actually reaches masterplan

### 5. Conversation Quality Overhaul

The 8B model was going deep into implementation details (debating OAuth vs JWT, API key rotation dashboards, specific authentication protocols) instead of asking high-level business questions. Conversations were lasting 15+ turns.

**Fixes in the conversation prompt:**
- Added explicit rule: "ONLY ask about BUSINESS fundamentals — target users, revenue model, competitive advantage, success metrics, biggest risks. Do NOT ask about specific technologies, authentication systems, or code architecture."
- Added turn budget display: "You have N turns left before analysis begins."
- After turn 7: prompt forces the model to end with `"Context is sufficient — activating specialist analysis."`

### 6. Masterplan Phase Override (Decoupling Text from Score)

The model would sometimes say "activating specialist analysis" (the masterplan trigger phrase) but the score hadn't actually crossed the threshold yet, so the conversation would just continue on the next turn. The text and the actual phase were completely decoupled.

**Two-layer fix:**
1. In `llm_client.py`: if `"activating specialist analysis"` is in the streamed message text, skip the eval call entirely and return maxed scores immediately (forcing masterplan next)
2. In `architect.py`: server-side phase override — if the phrase is detected OR turn number ≥ 9, force `new_phase = "masterplan"` regardless of score

### 7. Rate Limit Fix for Specialist Agents

Running 5 parallel Groq calls simultaneously was hitting the 6,000 tokens-per-minute free-tier limit (3 out of 5 agents returned `Error code: 429`).

**The math:**
- Each specialist agent call = ~1,500 input tokens (system prompt + full conversation) + 400 output tokens = ~1,900 tokens
- 5 parallel calls = ~9,500 tokens launched simultaneously → instant 429

**Fixes:**
- Agents now run **sequentially** with 1.5s delay between each call
- Conversation passed to agents is **trimmed** to first message + last 4 turn-pairs (was passing the full 15+ turn conversation)
- Agent `max_tokens` reduced 400 → 250
- Added 3-attempt retry with 4s/8s exponential backoff on 429 errors

**Token budget after fix:**
- ~600 input tokens (trimmed) + 250 output = ~850 per agent
- 5 agents × 850 = ~4,250 tokens total, spread over ~8s → well under 6k TPM

### 8. Masterplan Threshold Lowered

Lowered from **85%** → **80%** in `eval_bar.py`. The 8B model's eval gives more conservative increments than the 70B model did, so conversations were reaching full context (15+ turns) without crossing 85%. 80% is the right balance — enough context for a solid masterplan.

---

## Architecture After Phase 2

```
Browser
  └── React frontend (Vite + Zustand)
        ├── token events → streams AI text word-by-word
        ├── choices event → renders 3-4 clickable reply pills
        ├── agent_report events → renders specialist cards as each arrives
        ├── synthesis_token events → streams final masterplan
        └── done event → final session state update

FastAPI backend
  ├── POST /sessions/                     — create session + first LLM turn
  ├── POST /sessions/{id}/message/stream  — SSE: token → result → [agent_reports → synthesis] → done
  ├── GET  /sessions/                     — list sessions (auth required)
  ├── GET  /sessions/{id}                 — fetch single session
  ├── POST /waitlist                      — email signup
  └── GET  /health

LLM routing (Groq path):
  ├── Conversation: llama-3.1-8b-instant (stream text) + separate JSON-mode call (eval)
  ├── Specialist agents: llama-3.1-8b-instant × 5 (sequential, trimmed input, 250 tokens each)
  └── Synthesis: llama-3.3-70b-versatile (streamed, 3000 tokens — quality matters here)

LLM routing (Anthropic path):
  ├── Conversation: claude-sonnet-4-6 (stream with ###JSON### separator)
  ├── Specialist agents: claude-haiku-4-5 × 5 (parallel OK, no rate limit concern)
  └── Synthesis: claude-sonnet-4-6 (streamed, 3000 tokens)
```

---

## SSE Event Types (Full List)

| Event type | When | Payload |
|-----------|------|---------|
| `token` | During conversation response | `{delta: string}` |
| `choices` | After response, if not masterplan phase | `{choices: string[]}` |
| `agent_report` | As each specialist agent completes | `{report: {key, title, icon, color, content}}` |
| `synthesis_token` | During masterplan synthesis streaming | `{delta: string}` |
| `done` | When everything is saved to DB | `{session: SessionData}` |

---

## Problems We Faced & How We Fixed Them

### 1. Multi-choice feature broke after switching to 8B model
**Problem**: After switching from `llama-3.3-70b-versatile` to `llama-3.1-8b-instant`, the reply choices disappeared after the first response. The 8B model wasn't reliably outputting the `###JSON###` separator in streaming, so the JSON parsing failed silently and fell back to `choices: []`.  
**Fix**: Two-call approach — stream text first with no format requirements, then a separate JSON-mode call for structured eval. The separator approach only runs on Anthropic where it's reliable.

### 2. Eval model setting phase to "masterplan" too early
**Problem**: The eval model was determining `phase: "masterplan"` after just 2 turns (it applied delta to current scores and crossed 0.85), which made choices empty even though the conversation was still early.  
**Fix**: Removed `phase` from eval output entirely. Server computes phase from actual score math. Eval model only outputs `eval_delta`, `new_assumptions`, and `choices`.

### 3. Specialist agents returning 429 rate limit errors
**Problem**: 5 parallel Groq calls with the full 15-turn conversation (~1,900 tokens each = ~9,500 total) hit the 6k TPM free-tier limit instantly. 3 out of 5 agents failed.  
**Fix**: Sequential execution with 1.5s gaps, trimmed conversation to last 4 pairs, reduced output to 250 tokens, added retry with backoff.

### 4. "Activating specialist analysis" text didn't trigger masterplan
**Problem**: The model would output the trigger phrase but the eval would give low score increments, so `new_phase` stayed as `stress_test` and the conversation continued asking questions next turn.  
**Fix**: Detect the phrase in the streamed message text at two levels — in `llm_client.py` (skip eval, return maxed scores) and in `architect.py` (force `new_phase = "masterplan"` as a safety net). Also hard turn limit at turn 9.

### 5. Conversation going 15+ turns deep into implementation details
**Problem**: The 8B model interpreted "tech context" questions as an invitation to debate OAuth vs JWT, API authentication systems, and specific code architecture — going 15+ turns without reaching masterplan.  
**Fix**: Rewrote conversation prompt to explicitly block implementation questions. Added turn budget display. Added hard wrap-up rule after turn 7 that forces the model to conclude.

### 6. Score never reaching 80% threshold
**Problem**: Eval delta bounds were capped at 0.15 per dimension. After 8 turns at average 0.10 increment, total score reached ~0.80 weighted but the specific distribution across dimensions didn't cross the threshold.  
**Fix**: Raised eval delta cap to 0.25. Added hard turn override: after turn 8, server forces all dimension deltas to max, guaranteeing masterplan phase regardless of score.

---

## Key Files Changed This Phase

| File | What Changed |
|------|-------------|
| `backend/llm_client.py` | Two-call Groq approach, 5 specialist agents, sequential execution, trimmed history, retry logic, activation phrase detection |
| `backend/api/routes/architect.py` | Multi-agent pipeline in SSE stream, phase override on activation phrase, choices gated on server-computed phase |
| `backend/db/models.py` | Added `agent_reports` JSON column |
| `backend/eval_bar.py` | Masterplan threshold lowered 0.85 → 0.80 |
| `frontend/src/store/sessionStore.ts` | Added `AgentReport` type, `currentAgentReports`, `isAnalyzing` state, handles all 5 SSE event types |
| `frontend/src/components/SessionPage.tsx` | Agent report cards with color borders, skeleton loaders, synthesis loading state, phase stepper header |
| `frontend/src/components/LandingPage.tsx` | Styled hero with italic amber "argues back", feature cards with colored top strip and hover effects |

---

## Concepts Learned This Phase

### Server-Sent Events (SSE) streaming
SSE is a one-way HTTP connection where the server sends events as they happen. Each event is a line starting with `data: ` followed by JSON. The connection stays open until the server sends all events.

```python
# Backend — async generator yielding SSE
async def event_stream():
    async for token in stream_llm():
        yield f"data: {json.dumps({'type': 'token', 'delta': token})}\n\n"
    yield f"data: {json.dumps({'type': 'done', 'session': ...})}\n\n"

return StreamingResponse(event_stream(), media_type="text/event-stream")
```

```typescript
// Frontend — reading the SSE stream
const response = await fetch('/sessions/id/message/stream', { method: 'POST', ... })
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // parse lines starting with "data: "
}
```

### Why parallel LLM calls hit rate limits
Rate limits on free-tier APIs are measured in **tokens per minute (TPM)**. If you launch 5 concurrent calls each with 1,500 input tokens + 400 output, you're requesting 9,500 tokens "simultaneously." The API sees all of them in the same rate-limit window and rejects the overflow. Sequential calls with small gaps spread the load across multiple windows.

### asyncio.wait vs sequential for agent streaming
The original design used `asyncio.wait(return_when=FIRST_COMPLETED)` to run all 5 agents in parallel and yield each report as it finished (whichever was fastest). This gives the best progressive UX but breaks with Groq TPM limits. Sequential execution sacrifices some speed (each card appears one at a time in order, not by completion speed) but is reliable.

### Two-call approach for structured + streaming LLM output
When you need BOTH streamed text (for UX) AND structured data (for scoring/choices), a single call can't do both reliably — especially on smaller models. The pattern:
1. Call 1: stream text freely, accumulate the full message
2. Call 2: non-streaming JSON-mode call with `messages + [assistant reply]` to extract structure

This is cleaner than embedding a separator in the stream because smaller models don't follow separator instructions reliably.

### Token trimming for long conversations
Passing a full 15-turn conversation to every specialist agent wastes tokens and hits rate limits. The first message (original idea) is always the most important context. The last 4 turns capture what was recently clarified. Everything in the middle is scaffolding the LLM doesn't need for focused analysis.

```python
def _trim_history_for_agents(history, max_pairs=4):
    if len(history) <= max_pairs * 2 + 1:
        return history
    return [history[0]] + history[-(max_pairs * 2):]
```

---

## What's Next

| Priority | Task |
|----------|------|
| High | Deploy Phase 2 to Railway (push to GitHub) |
| High | Get real user feedback on the multi-agent flow |
| Medium | Add a "copy masterplan" button alongside the download button |
| Medium | Show token usage / cost estimate per session |
| Low | Let users re-run specialist agents if rate limit caused errors |
| Low | Admin dashboard to view all sessions and their masterplans |
