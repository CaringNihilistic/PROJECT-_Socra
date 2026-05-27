# Socra — Build Journal: Phase 5

> Continuing from JOURNEY4.md. Phase 5 covers the Startup Tribunal feature (3 AI judges × 4 rounds), TribunalCard shareable verdict, mobile-responsive Tribunal layout, tribunal resume, and the 90-day outcome follow-up email system.

---

## What We Added This Phase

### 1. Startup Tribunal Mode

A parallel interrogation mode where 3 AI personas — **Investor**, **Customer**, and **Competitor** — simultaneously grill the founder across 4 rounds, then deliver individual Pass/Fail verdicts.

**Why it exists:** The standard Socratic mode is sequential and collaborative. Tribunal is adversarial and parallel — better for founders who want to pressure-test a specific commitment or simulate a pitch panel.

**Session flow:**
```
LandingPage mode selector → createSession(idea, mode="tribunal")
  → Backend skips Socratic LLM entirely (no initial question)
  → TribunalPage renders (3-column layout or mobile tab switcher)
  → Auto-sends initial idea on mount
  → Streams 3 persona responses per round via SSE
  → After round 4 → payment_required gate (₹199)
  → User pays → POST /tribunal/unlock → generates composite verdicts
  → TribunalCard shown with Pass/Fail per persona + composite grade
```

**The 3 personas:**
| Persona | Role | Bias |
|---------|------|------|
| Investor | Series A VC | Market size, defensibility, founder-market fit |
| Customer | Target user | Pain intensity, willingness to pay, switching cost |
| Competitor | Incumbent player | Execution barriers, replication speed, moat erosion |

**Round structure:**
- 4 rounds per tribunal
- Each round: user sends one message → 3 personas respond in parallel (streamed sequentially)
- `tribunal_history` stores every turn: `[user_msg, investor_msg, customer_msg, competitor_msg, ...]`
- Round number derived: `len(tribunal_history) // 4 + 1` (same formula on both frontend and backend)

---

### 2. Backend — Tribunal Endpoints

**`POST /sessions/{id}/tribunal/message`**

Streams 3 persona responses per round. Key invariant: `round_complete` is always emitted **before** `payment_required` so frontend has full round 4 history when the gate fires.

```python
# SSE event order per round:
# persona_token × N  (Investor streaming)
# persona_done       (Investor done)
# persona_token × N  (Customer streaming)
# persona_done       (Customer done)
# persona_token × N  (Competitor streaming)
# persona_done       (Competitor done)
# round_complete     (full updated tribunal_history)
# payment_required   (only on round 4 if billing enabled and not paid)
```

**`POST /sessions/{id}/tribunal/unlock`**

Called after payment verification. Generates composite verdicts idempotently — if verdicts already exist in DB, returns cached result without re-calling LLM.

```python
# Verdict structure:
{
  "investor": {"verdict": "PASS"|"FAIL", "score": 7.5, "quote": "...", "key_insight": "..."},
  "customer":  {"verdict": "PASS"|"FAIL", "score": 6.0, "quote": "...", "key_insight": "..."},
  "competitor":{"verdict": "PASS"|"FAIL", "score": 4.5, "quote": "...", "key_insight": "..."},
  "composite_score": 6.0,
  "composite_grade": "STRONG",   # GREENLIT | STRONG | CHALLENGED | REJECTED
  "composite_summary": "..."
}
```

**Grade thresholds:**
| Grade | Score |
|-------|-------|
| GREENLIT | ≥ 7.5 |
| STRONG | ≥ 6.0 |
| CHALLENGED | ≥ 4.5 |
| REJECTED | < 4.5 |

---

### 3. Dual Billing (Tribunal vs Standard)

Tribunal has separate payment columns and checkout flow from the standard masterplan paywall.

**DB columns (separate):**
```python
paid            = Column(Boolean, default=False)   # standard masterplan
tribunal_paid   = Column(Boolean, default=False)   # tribunal verdicts
```

**Billing routing:**
- Razorpay checkout uses `socra_mode` in payment link notes (`"standard"` or `"tribunal"`)
- Tribunal callback URL uses `?tribunal_sid=` (vs standard `?sid=`)
- Webhook reads `socra_mode` → marks correct `paid` column
- `VerifyRequest` has `mode: str = "standard"` → routes to correct column

**Price:** ₹199 for tribunal (vs ₹499 for standard masterplan)

---

### 4. TribunalCard — Shareable Verdict Card

`frontend/src/components/TribunalCard.tsx` — Spotify Wrapped-style shareable card shown after verdicts are unlocked.

**Visual design:**
- Dark gradient background with radial glow tinted by composite grade color
- Large composite score + grade badge in header
- 3 persona rows: icon, persona name, PASS/FAIL badge, verdict quote, key insight, score chip
- Footer: idea snippet + session ID

**Grade colors:**
| Grade | Color |
|-------|-------|
| GREENLIT | `#34d399` (emerald) |
| STRONG | `#f59e0b` (amber) |
| CHALLENGED | `#e85d26` (orange) |
| REJECTED | `#dc2626` (red) |

**`PERSONA_ORDER = ['investor', 'customer', 'competitor']`** — fixed order ensures consistent display regardless of which personas were streamed first.

Also updated `CardPage.tsx`: detects `session.tribunal_verdicts` → renders `TribunalCard` instead of `VerdictCard`.

---

### 5. TribunalPage — 3-Panel Interrogation UI

`frontend/src/components/TribunalPage.tsx`

**Desktop layout:** 3-column flex, each column is a `PersonaColumn` sub-component with scrollable message history and streaming text.

**Mobile layout:** Single-column tab switcher with auto-advance to the active streaming persona.

```typescript
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}
```

**Mobile auto-advance:** when `tribunalActivePersona` changes and viewport is mobile, `selectedTab` updates to match the active persona index so the user always sees who's currently speaking.

**Auto-send on mount:**
```typescript
useEffect(() => {
  if (!session || autoSent || tribunalHistory.length > 0) return
  setAutoSent(true)
  sendTribunalMessage(session.initial_idea)
}, [session])
```
Guard checks `tribunalHistory.length > 0` so resumed sessions don't re-send.

**Payment gate:** full-screen overlay with blur backdrop, ₹199, calls `createTribunalCheckout()`.

**Send disabled conditions:**
```typescript
disabled={tribunalStreaming || tribunalPaymentRequired || !!verdicts || completedRounds >= 4}
```

---

### 6. LandingPage — Mode Selector

Mode selection happens on the landing page before creating a session.

- `mode: 'standard' | 'tribunal'` state (default `'standard'`)
- Two buttons in the input footer: **Standard** and **Tribunal**
- `onMouseEnter` updates visual highlight; click calls `handleSubmit(specificMode)`
- Session history: tribunal sessions show ⚖️ badge, amber border, grade badge or "X/4 rounds" indicator

```typescript
const handleSubmit = async (overrideMode?: 'standard' | 'tribunal') => {
  const selectedMode = overrideMode ?? mode
  // ...
  await createSession(idea, selectedMode)
}
```

---

### 7. Tribunal Resume

Session history entries for tribunal sessions have a resume button that takes the user back into `TribunalPage` mid-interrogation.

**Resume flow:**
```
LandingPage session history → click Resume on tribunal entry
  → resumeSession(id)
  → store restores: tribunalRound = Math.floor(tribunal_history.length / 4) + 1
  → App.tsx routes: session.mode === 'tribunal' ? <TribunalPage /> : <SessionPage />
  → TribunalPage: autoSent guard prevents re-sending initial idea
```

`_serialize_summary()` in `sessions.py` returns `mode`, `tribunal_rounds_done` (len//4), `tribunal_verdict_grade` so the session history card can display correct state.

---

### 8. Zustand Store — Tribunal State

New state fields added to the store:

```typescript
tribunalStreaming: boolean
tribunalActivePersona: string | null      // 'investor' | 'customer' | 'competitor'
tribunalPersonaStreams: Record<string, string>  // live token buffer per persona
tribunalRound: number
tribunalPaymentRequired: boolean
```

**SSE event handlers:**
| Event | Handler |
|-------|---------|
| `persona_token` | Append delta to `tribunalPersonaStreams[persona]` |
| `persona_done` | Finalize persona stream |
| `round_complete` | Clear `tribunalPersonaStreams: {}`, update `tribunal_history` |
| `payment_required` | `set({ tribunalPaymentRequired: true })` |
| `tribunal_verdict` | `set({ tribunal_verdicts: verdicts })` |

**Bug fixed during audit:** `round_complete` must clear `tribunalPersonaStreams` so next round starts fresh. Originally the clearing happened in a different place, causing stale stream text to bleed into the next round's display.

---

### 9. 90-Day Outcome Follow-Up Email

After a user unlocks their masterplan or tribunal verdict, a small email capture appears. 90 days later, a cron job asks what actually happened.

**Backend — `backend/api/routes/followup.py`:**

```
POST /sessions/{id}/follow-up      — saves email to session.follow_up_email
POST /admin/send-follow-ups        — protected by X-Admin-Secret header
```

Send logic:
- Queries sessions where `follow_up_email IS NOT NULL AND follow_up_sent = FALSE`
- Filters to sessions created 89–91 days ago (±1 day window)
- Sends dark-themed HTML email via Resend API (using `httpx`, no new package)
- Marks `follow_up_sent = TRUE` after successful send
- Returns `{"sent": N, "failed": N, "total": N}`

**Email content:**
- Dark background (`#0d0c0b`) matching Socra's aesthetic
- Idea snippet, score, tribunal grade (if applicable)
- 3 CTA buttons: "I built it", "I pivoted", "I moved on"
- All buttons link to `socra.app` — future: deep link to outcome form

**Frontend — `FollowUpEmailCapture.tsx`:**
- Inline component with email input + "Remind me" button
- States: idle → saving → done (green tick + "We'll check in with you in 90 days.")
- Shown after masterplan in `SessionPage`, and after `TribunalCard` in `TribunalPage`

**DB columns (already added in Phase 5 start):**
```python
follow_up_email = Column(String(320), nullable=True)
follow_up_sent  = Column(Boolean, default=False)
```

**Sender:** `onboarding@resend.dev` (Resend shared domain — no DNS verification needed until a custom domain is purchased)

**Cron:** Not set up in Railway. Use [cron-job.org](https://cron-job.org) — free, daily POST to `/admin/send-follow-ups` with `X-Admin-Secret` header.

---

## Bugs Fixed This Phase

### 1. Wasted LLM call on tribunal session create
**Cause:** `POST /sessions/` called the Socratic LLM unconditionally to generate the first question, even for tribunal sessions that don't need it.
**Fix:** Early return for `mode == "tribunal"` — creates session row and returns immediately with `choices: []`.

### 2. Stale history on payment_required
**Cause:** Backend emitted `payment_required` before `round_complete` on round 4. Frontend set the payment gate before storing the completed round, losing round 4 history from the UI.
**Fix:** Backend now always emits `round_complete` first, then `payment_required`.

### 3. Stale persona streams between rounds
**Cause:** `tribunalPersonaStreams` was not cleared on `round_complete`. Round N+1 persona text appended to round N's leftover buffer.
**Fix:** `round_complete` handler: `set({ tribunalPersonaStreams: {} })`.

### 4. TS6133: `tribunalRound` declared but never read
**Cause:** Removed a computed variable but left its `useSessionStore` selector in TribunalPage.
**Fix:** Removed the selector line.

### 5. TS6133: `isWaiting` declared but never read
**Cause:** Removed usage but left the variable declaration in PERSONAS.map loop.
**Fix:** Removed the variable.

### 6. TS2552: `roundInProgress` not found
**Cause:** After removing the variable block, `isStreaming={roundInProgress}` remained in PersonaColumn call.
**Fix:** Replaced with `isStreaming={tribunalStreaming}`.

### 7. Textarea not accepting input
**Cause:** `disabled={!canSend && !tribunalStreaming}` — since `canSend` requires `input.trim()`, an empty textarea was always disabled, preventing typing.
**Fix:** Separate input-disabled from send-disabled: `disabled={tribunalStreaming || tribunalPaymentRequired || !!verdicts || completedRounds >= 4}`.

---

## Architecture After Phase 5

```
Browser
  └── React (Vite + Zustand + Clerk)
        ├── LandingPage     — mode selector (standard | tribunal) + session history
        ├── SessionPage     — Socratic interrogation + masterplan + FollowUpEmailCapture
        ├── TribunalPage    — 3-panel (desktop) / tab switcher (mobile) + payment gate
        ├── TribunalCard    — shareable verdict card (also at /card/:id)
        ├── CardPage        — routes to VerdictCard or TribunalCard
        └── FollowUpEmailCapture — shown after masterplan and tribunal verdict

FastAPI backend
  ├── POST /sessions/                           — create (standard or tribunal mode)
  ├── POST /sessions/{id}/message/stream        — standard SSE pipeline
  ├── POST /sessions/{id}/tribunal/message      — tribunal SSE pipeline (3 personas)
  ├── POST /sessions/{id}/tribunal/unlock       — generate verdicts post-payment
  ├── POST /sessions/{id}/follow-up             — save follow-up email
  ├── POST /admin/send-follow-ups               — batch send 90-day emails (cron target)
  ├── POST /billing/checkout                    — Razorpay checkout (standard)
  ├── POST /billing/tribunal-checkout           — Razorpay checkout (tribunal)
  ├── POST /billing/webhook                     — Razorpay webhook (marks paid/tribunal_paid)
  ├── POST /billing/verify                      — manual payment verification
  ├── POST /sessions/{id}/unlock                — generate masterplan post-payment
  ├── POST /sessions/{id}/pitch-deck            — generate + cache pitch deck
  ├── POST /sessions/{id}/pitch-deck/html       — export interactive HTML
  ├── POST /sessions/{id}/debate                — generate Bull vs Bear debate
  └── GET  /health

DB schema (sessions table — cumulative):
  id, user_id, initial_idea
  problem_clarity, scale_constraints, tech_context, success_definition, risk_awareness
  phase, turn_number
  conversation_history, assumptions, masterplan
  agent_reports, pitch_deck, debate
  paid
  mode, tribunal_history, tribunal_verdicts, tribunal_paid
  follow_up_email, follow_up_sent
  created_at, updated_at
```

---

## SSE Event Reference (Tribunal Pipeline)

```
POST /sessions/{id}/tribunal/message
  │
  ├── {type: "persona_token", persona: "investor", delta: "..."}  × N
  ├── {type: "persona_done",  persona: "investor"}
  ├── {type: "persona_token", persona: "customer", delta: "..."}  × N
  ├── {type: "persona_done",  persona: "customer"}
  ├── {type: "persona_token", persona: "competitor", delta: "..."} × N
  ├── {type: "persona_done",  persona: "competitor"}
  ├── {type: "round_complete", round: N, tribunal_history: [...]}
  └── {type: "payment_required", session_id: "..."}   # only on round 4 if unpaid

POST /sessions/{id}/tribunal/unlock  (after payment)
  └── {type: "tribunal_verdict", verdicts: {...}}
```

---

## Key Files Changed This Phase

| File | What Changed |
|------|-------------|
| `backend/api/routes/architect.py` | `stream_tribunal_turn`, `generate_tribunal_verdicts` imported; tribunal message + unlock endpoints |
| `backend/api/routes/sessions.py` | `mode` field in `CreateSessionRequest`; tribunal early return; `mode`, `tribunal_*` in `_serialize()` and `_serialize_summary()` |
| `backend/api/routes/billing.py` | `socra_mode` in Razorpay notes; `?tribunal_sid=` callback; tribunal_paid webhook routing |
| `backend/api/routes/followup.py` | **New file**: save-email + batch-send endpoints |
| `backend/db/models.py` | `mode`, `tribunal_history`, `tribunal_verdicts`, `tribunal_paid`, `follow_up_email`, `follow_up_sent` columns |
| `backend/db/database.py` | Idempotent migrations for all 6 new columns |
| `backend/core/config.py` | `razorpay_tribunal_amount`, `resend_api_key` |
| `backend/main.py` | `followup` router registered |
| `frontend/src/store/sessionStore.ts` | `TribunalTurn`, `TribunalPersonaVerdict`, `TribunalVerdicts` types; tribunal state + actions; `createTribunalCheckout`, `verifyAndUnlockTribunal`, `saveFollowUpEmail` |
| `frontend/src/components/TribunalPage.tsx` | **New file**: full tribunal UI, mobile/desktop layout, payment gate |
| `frontend/src/components/TribunalCard.tsx` | **New file**: shareable verdict card |
| `frontend/src/components/FollowUpEmailCapture.tsx` | **New file**: email opt-in component |
| `frontend/src/components/LandingPage.tsx` | Mode selector, tribunal session history entries |
| `frontend/src/components/SessionPage.tsx` | `FollowUpEmailCapture` after masterplan |
| `frontend/src/components/CardPage.tsx` | Tribunal detection → renders `TribunalCard` |
| `frontend/src/App.tsx` | `tribunal_sid` payment return detection; `session.mode === 'tribunal'` routing |

---

## Concepts Learned This Phase

### Parallel streaming requires careful event ordering
When 3 personas stream sequentially but the UI shows them in parallel columns, event ordering matters. `round_complete` must fire after all 3 `persona_done` events and must carry the full updated history snapshot — not a delta. This is the only way the frontend can reliably know what's in the DB without an extra fetch.

### Dual payment columns vs. a payment type enum
We chose separate boolean columns (`paid`, `tribunal_paid`) over a single enum column. This is slightly denormalized but avoids the complexity of migrating an enum type in Postgres. If a third paid feature were added, an enum or a separate `payments` table would be cleaner.

### Payment callback URL disambiguation
When the user returns from Razorpay, the URL has either `?sid=` or `?tribunal_sid=`. This is a simpler signal than encoding mode in the amount or in a separate URL query parameter — it's unambiguous and doesn't require decoding the payment object.

### Mobile tab auto-advance UX
On mobile, auto-advancing to the active streaming persona feels natural because users expect to "watch" personas respond. On desktop, all 3 columns are visible so auto-advance is irrelevant. The key is using `useEffect` on `tribunalActivePersona` change rather than on each token — advancing per-token would cause visible tab flickering.

### 90-day email as a retention loop
Standard activation emails (welcome, confirm, etc.) are table stakes. A 90-day outcome email is rarer because most SaaS products don't have a natural 90-day lifecycle event. For Socra, the insight is that the product's value claim — "we help you decide" — can only be validated in retrospect. The email closes that loop and surfaces social proof from real outcomes.

---

## What's Next

| Priority | Task |
|----------|------|
| High | UI/UX redesign — full visual overhaul (dark, editorial, premium feel) |
| High | Set up cron-job.org for daily `/admin/send-follow-ups` POST |
| High | Buy custom domain → verify in Resend → update `from` address in `followup.py` |
| Medium | Outcome tracking — "I built it" / "I pivoted" / "I moved on" CTA links capture real outcomes into DB |
| Medium | Anonymous → authenticated session migration on sign-in |
| Medium | Backend session ownership check on all endpoints |
| Medium | Tribunal sharing — LinkedIn-optimized OG image from TribunalCard |
| Medium | Waitlist → Clerk invite flow (convert waitlist signups to accounts) |
| Low | PDF export — full masterplan + agent reports as formatted PDF |
| Low | Analytics — Posthog or Plausible for session start, payment, verdict unlock events |
| Low | Rate limiting — per-IP throttle on `/sessions/` to prevent abuse |
