# Socra — Build Journal: Phase 7

> Continuing from JOURNEY6.md. Phase 7 covers end-to-end testing of both modes (standard masterplan + tribunal), a full round of bug fixes discovered during live testing, a major architectural fix to the agent pipeline, model upgrade to Anthropic Haiku, and a 3-page post-analysis flow redesign.

---

## What We Did This Phase

### 1. Dev Payment Bypass System

**Problem:** Testing the full paid flow required actually paying ₹499 / ₹199, making it impossible to iterate quickly on the masterplan and tribunal pipelines.

**Solution:** Added `POST /sessions/{id}/admin-mark-paid` — an endpoint that sets `paid=True` and `tribunal_paid=True`. Protected by `ADMIN_SECRET` env var (when set, requires matching `X-Admin-Secret` header; when unset, open for dev).

Frontend added `[DEV] Skip payment & unlock` button inside both paywall modals, visible only when `VITE_RAZORPAY_KEY_ID` is not set. Backend always fires `payment_required` now (removed the Razorpay key gate), so the modal appears in all environments consistently.

**Bugs fixed along the way:**
- Initial 403: `not _cfg.admin_secret` evaluates True when secret is empty → always blocked. Flipped logic to `if _cfg.admin_secret and x_admin_secret != _cfg.admin_secret`.
- Black screen on session resume: `paymentRequired: true` was persisting in Zustand state across sessions. Fixed by resetting all payment state in `resumeSession()` and `createSession()`.
- PaywallModal was gated by `{BILLING_ENABLED && <PaywallModal />}` while the dev button inside it required `!BILLING_ENABLED` — mutually exclusive. Fixed by always rendering `<PaywallModal />` (it self-hides when `!paymentRequired`).

**Files changed:** `backend/api/routes/sessions.py`, `backend/api/routes/architect.py`, `frontend/src/store/sessionStore.ts`, `frontend/src/components/SessionPage.tsx`

---

### 2. Tribunal Sequential Streaming Fix

**Problem:** All three tribunal persona panels showed waiting dots simultaneously (felt parallel), and after each persona completed streaming (`persona_done` event), their content went blank while the next persona was typing.

**Root cause:** The streaming display block required `isActive && streamText` to show content. After `persona_done`, `isActive` became false, so the completed content became invisible. Also, the waiting indicator used `!isActive && !streamText`, showing dots for ALL not-yet-started personas at once.

**Fix in `TribunalPage.tsx`:**
- Content shows whenever `streamText` is non-empty, regardless of `isActive` — cursor `▋` only appended when `isActive`
- Waiting dots changed to `isActive && !streamText` — only the currently-typing persona shows dots

**Result:** Investor streams → stays visible → Customer dots appear → Customer streams → stays visible → Competitor dots → etc. Clearly sequential.

**Files changed:** `frontend/src/components/TribunalPage.tsx`

---

### 3. Tribunal Verdict Accuracy Improvements

**Problem:** Investor scored 75/100 but FAIL — score and pass/fail were decided independently with no calibration. Judges only saw their own Q&A thread, missing context the other judges surfaced.

**Three fixes:**

1. **Cross-pollination:** Built `full_transcript` from the entire tribunal history and injected it into each verdict prompt. All judges now see all questions and answers before deciding.

2. **Scoring rubric:** Added explicit anchors to the verdict prompt:
   - 80–100: Pass
   - 65–79: Pass
   - 50–64: Fail
   - 35–49: Fail
   - 0–34: Fail

3. **Score/pass consistency enforcement:** Added post-processing: if `pass=True` and `score < 65`, raise score to 65. If `pass=False` and `score >= 65`, cap at 59.

**Max tokens** for verdict increased from 300 → 500 to allow reasoning before JSON output.

**Files changed:** `backend/llm_client.py`

---

### 4. Stream Reliability + Trust UX

**Problem:** Users couldn't tell if Socra was broken or just thinking. Frozen streams left the spinner running indefinitely. Empty messages appeared as blank S bubbles.

**Fixes implemented:**

| Fix | Detail |
|---|---|
| Stream timeout | 20s token timeout — kills hanging stream, sets `streamError` state |
| Retry button | Red banner with "Retry →" re-sends last message on timeout or network drop |
| Saved flash | Green "Saved ✓" appears for 2s after each successful turn |
| Progress hint | Context-aware message: "3 more specific answers needed" / "Almost there" |
| Refusal message | Reworded from error-like amber to constructive muted tone |
| Chips persist | Suggested answer chips stay visible while user types; clear only on send |
| Empty message guard | Backend: >15 meaningful chars after stripping markdown before saving to DB |
| Frontend filter | `msg.content?.replace(/[*#\-_>\s]/g, '').length > 5` — filters "**" style truncated messages |

**Files changed:** `backend/api/routes/architect.py`, `frontend/src/store/sessionStore.ts`, `frontend/src/components/SessionPage.tsx`, `backend/eval_bar.py`

---

### 5. Quick Reply UX Fix + Choices Prompt Fix

**Problem 1 — Quick replies sent directly:** Clicking "integration with industry-specific tools is key" sent that 6-word phrase as-is. LLM received thin input → produced thin response.

**Fix:** `onClick={() => setInput(choice)}` — pre-fills textarea so user can edit and expand before sending.

**Problem 2 — Choices showed questions not answers:** After fixing the send behavior, the choices themselves were still wrong — they were follow-up questions ("What is the market size?") instead of answer starters ("CAC ~$200 via LinkedIn outbound").

**Root cause:** The streaming system prompt said `"choices: 3-4 options as archetypal user responses"` — too abstract. Gemini interpreted "responses" as questions.

**Fix:** Replaced abstract instruction with a concrete worked example showing exact output format, explicit WRONG vs RIGHT examples, and hardcoded constraint: "NEVER leave Part 1 empty."

**Problem 3 — Socra responses disappearing:** The LLM was putting content in `choices[]` and leaving Part 1 (before `###JSON###`) empty. Empty Part 1 → filtered out → blank S bubble → user confused.

**Fix:** Frontend fallback — when `currentChoices.length > 0` but last history message is from user (Part 1 was filtered), show `"Pick one of the suggested answers below, or type your own response."` with the Socra avatar.

**Files changed:** `backend/llm_client.py`, `frontend/src/components/SessionPage.tsx`

---

### 6. Model Upgrade — Anthropic Haiku 4.5

**User added `ANTHROPIC_API_KEY` to Railway.** All LLM calls now route through Haiku 4.5 (priority 1) with Gemini Flash as fallback.

**Added per-call token + cost logging** to `_call_anthropic` and `_call_google`:
```
anthropic | in=2847 out=312 cost=$0.00031
google | in=4200 out=890 cost=$0.00058
```
Visible in Railway logs filtered by `usage`.

**Cost comparison for full session (tribunal + masterplan + deck):**

| Model | Cost/session | Margin on ₹698 revenue |
|---|---|---|
| Gemini Flash | $0.012 | 99.9% |
| Haiku 4.5 | $0.146 | 98.2% |
| Sonnet 4.6 | $0.560 | 93.2% |

For $10 in Anthropic credits: ~68 full sessions on Haiku.

**Files changed:** `backend/llm_client.py`, `backend/core/config.py`

---

### 7. Anthropic 400 Error Fixes (Multiple)

Multiple sources of `invalid_request_error` 400 were discovered and fixed:

**Fix 1 — Consecutive same-role messages in `_trim_history_for_agents`:**
When empty assistant messages were filtered from DB history, two consecutive user messages could appear. Anthropic rejects this. Fixed by merging consecutive same-role messages and ensuring history starts with a user message.

**Fix 2 — `run_devils_advocate` passing empty messages `[]`:**
`_call_anthropic(system, [], ...)` always 400s — Anthropic requires at least one user message. Fixed by adding `trigger_msg = [{"role": "user", "content": "Provide your critical review of this masterplan."}]`.

**Fix 3 — `_call_fast_llm` fallthrough:**
Added `try/except anthropic.BadRequestError` that logs and falls through to Google instead of surfacing the error as "Analysis unavailable".

**Fix 4 — 10 agents showing instead of 5:**
`unlock_stream` started `new_agent_reports = list(original_agent_reports)` — appended 5 new reports to 5 previous failed ones = 10. Fixed to always start from empty list.

**Files changed:** `backend/llm_client.py`, `backend/api/routes/architect.py`

---

### 8. Core Agent Pipeline Fix — Option B (The Big One)

**Problem:** All 5 council agents were generating Socratic questions instead of specialist analysis. The "Chairman's Masterplan" synthesis was also generating a question. Every agent card showed "Question 3: ..." style content.

**Root cause:** After Anthropic 400 (fallthrough to Google), Google received the conversation history — 30 turns of Q&A in Socratic format. Google pattern-matched the format and generated more questions. The specialist system prompt ("analyze as The Banker") was overwhelmed by the conversational context.

**Option B fix — `_build_agent_msgs` redesign:**

Before:
```python
trimmed = _trim_history_for_agents(conversation_history)  # first + last 8 messages
msgs = [{"role": m["role"], "content": m["content"]} for m in trimmed]
```

After:
```python
# Single clean user message with just the idea and founder's answers
initial_idea = conversation_history[0]["content"]
user_answers = [m["content"] for m in conversation_history[1:] if m["role"] == "user"]

parts = [f"STARTUP IDEA:\n{initial_idea}"]
if user_answers:
    parts.append(f"FOUNDER'S ANSWERS:\n" + "\n\n".join(f"- {a}" for a in user_answers[-8:]))
if web_context:
    parts.append(f"LIVE MARKET RESEARCH:\n{web_context}")

return [{"role": "user", "content": "\n\n".join(parts)}]
```

**Why this works:**
- No role-alternation issues → no Anthropic 400
- No Q&A format to pattern-match → LLM generates analysis not questions
- Agents receive exactly what they need: the idea, what the founder said, market data
- Applied to all 5 agents, synthesis, and the sync masterplan fallback path

**Files changed:** `backend/llm_client.py`, `backend/api/routes/architect.py`

---

### 9. 3-Page Post-Analysis Flow

**Problem:** Council analysis, masterplan, devil's advocate, and pitch deck were all crammed onto one scrollable page — overwhelming and unclear.

**New flow — `view` state: `'chat' | 'council' | 'masterplan'`**

**Page 1 — Chat** (unchanged Socratic conversation, no council shown inline)
- Streaming indicator during agent analysis: "The Council is analysing... 3/5 advisors done"
- `[DEV] Skip to masterplan` button in dev mode (visible from turn 1)

**Page 2 — The Council** (auto-navigates here after masterplan generates)
- All 5 specialist agent cards (collapsed, expandable)
- Devil's Advocate below with 5 failure critiques
- "Continue to Masterplan →" CTA
- `[DEV] Re-run` button to re-trigger the full pipeline without starting a new session

**Page 3 — Masterplan**
- "← Back to Council" navigation
- Amber pitch deck CTA banner: Generate / View / .md export
- Full Chairman's Masterplan markdown
- Share / Card / Compare actions in header

**Files changed:** `frontend/src/components/SessionPage.tsx`

---

### 10. Dev Testing Shortcuts

**Problem:** Testing changes to the agent pipeline required going through 8-10 turns of Socratic conversation every time — ~10 minutes per test cycle.

**Two shortcuts added:**

`[DEV] Skip to masterplan` — appears in chat view from turn 1 (dev mode only):
- Calls `admin-mark-paid` → streams `/unlock` immediately
- Tests full council + masterplan pipeline in ~30 seconds

`[DEV] Re-run` — appears on Council page header (dev mode only):
- Clears agent reports, re-runs unlock stream on same session
- Tests pipeline changes without creating a new session

Both only render when `VITE_RAZORPAY_KEY_ID` is not set.

**Files changed:** `frontend/src/store/sessionStore.ts`, `frontend/src/components/SessionPage.tsx`

---

### 11. Superpowers Skills Installed

Manually fetched and installed 4 skills from [obra/superpowers](https://github.com/obra/superpowers) into `.claude/commands/`:

| Command | When to use |
|---|---|
| `/systematic-debugging` | Any bug — enforces root cause investigation before fixing |
| `/brainstorming` | Before any new feature — explores design, proposes 2-3 approaches |
| `/requesting-code-review` | After completing a feature or before deploying |
| `/verification-before-completion` | Before claiming anything is done — requires running actual commands |

Note: `/plugin install superpowers@claude-plugins-official` does not work — the plugin marketplace does not exist in Claude Code yet.

---

### 12. Minor Fixes

- **Pitch deck HTML export removed** — button wasn't working; removed `handleExport`, `useState`, `API_URL`, `sessionId` and `idea` props from `PitchDeckView.tsx`
- **Bull vs Bear debate removed** — removed from all UI, store, and imports
- **`safe_msgs` consistency** — Google synthesis was using raw `messages`, Groq was using `safe_msgs`. Unified to `safe_msgs` across all three providers
- **`idea` prop cleaned up** — `PitchDeckView` no longer needs `idea` or `sessionId` since export was removed

---

## Architecture After Phase 7

```
User flow:
  Chat (Socratic Q&A)
    ↓ payment gate
  unlock endpoint
    ↓
  _build_agent_msgs()  ← NEW: single clean message (idea + answers + web context)
    ↓ shared across all 5 agents
  5 × run_specialist_agent()  [parallel, asyncio.as_completed]
    ↓
  _build_synthesis_prompt(agent_reports)
  _stream_synthesis_tokens()  ← Haiku 4.5 (Anthropic priority 1)
    ↓
  run_devils_advocate()  ← Haiku 4.5 with trigger_msg
    ↓
  Council page → Masterplan page
```

---

## Key Files Changed This Phase

| File | What Changed |
|---|---|
| `backend/api/routes/sessions.py` | `admin-mark-paid` endpoint added |
| `backend/api/routes/architect.py` | Payment gate always fires; clean agent/synthesis messages; fresh agent_reports on unlock |
| `backend/llm_client.py` | `_build_agent_msgs` redesigned (Option B); devil's advocate trigger_msg fix; Anthropic fallthrough; cross-pollination verdicts; scoring rubric; cost logging |
| `backend/eval_bar.py` | Refusal message reworded to constructive tone |
| `frontend/src/store/sessionStore.ts` | Stream timeout; saved flash; retry; devRerunMasterplan; payment state reset on resume |
| `frontend/src/components/SessionPage.tsx` | 3-page view system; dev shortcuts; choices prompt fallback; chips pre-fill |
| `frontend/src/components/TribunalPage.tsx` | Sequential streaming fix |
| `frontend/src/components/PitchDeckView.tsx` | HTML export removed; props cleaned up |
| `.claude/commands/` | 4 Superpowers skills installed |

---

## Concepts Learned This Phase

### The Q&A format trap
Passing conversation history to generation agents is dangerous when the history is in Socratic Q&A format. LLMs pattern-match the format and continue it. The fix is structural: separate the context the user provided (idea, answers) from the format it was collected in (Q&A). Agents need the former, not the latter.

### Anthropic's strict message validation
Anthropic rejects API calls for: empty `messages[]`, consecutive same-role messages, messages starting with `assistant` role. Google and Groq are more lenient. When mixing providers, always sanitize messages to the strictest standard (Anthropic's) before any call.

### Empty messages as a silent failure mode
When a stream dies before generating content, saving an empty assistant message to DB creates a "ghost turn" — the S bubble appears but is blank. The bug is subtle because the frontend sees the turn in history but renders nothing. Guard on both sides: backend (min meaningful chars) and frontend (strip markdown then check length).

### Paywall state is session-scoped, not app-scoped
`paymentRequired: true` in Zustand persists across the app session. Navigating to a different session shows the paywall from the previous one. Any action that changes the active session (resume, create) must reset payment state.

### Trust is built through small signals
The gap between "is this working?" and "this is broken" is filled by: saved flash, timeout messages, retry buttons, progress hints. None of these change the product — they change how the user perceives reliability. A 15-second silence feels like a crash; a 15-second wait with a progress indicator feels like normal operation.

---

## What's Next

| Priority | Task |
|---|---|
| High | UI/UX redesign — full visual overhaul (dark, editorial, premium feel) |
| High | Set up cron-job.org for daily `/admin/send-follow-ups` POST |
| High | Buy custom domain → verify in Resend → update `from` address |
| Medium | Socra should answer direct questions — currently locked in interrogation mode only |
| Medium | Outcome tracking — "I built it" / "I pivoted" / "I moved on" CTA links |
| Medium | Anonymous → authenticated session migration on sign-in |
| Medium | Backend session ownership check on all endpoints |
| Medium | Hybrid model routing — Sonnet for synthesis + verdicts, Haiku for everything else |
| Low | Add Anthropic `cache_control` to `shared_msgs[0]` for explicit prompt caching |
| Low | Analytics — PostHog or Plausible for session start, payment, verdict unlock events |
