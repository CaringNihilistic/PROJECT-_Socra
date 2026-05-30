# Socra — Build Journal: Phase 8

> Continuing from JOURNEY7.md. Phase 8 covers dead-code removal, a real identity-based admin role, the tribunal round-freeze bug, tribunal verdict quality (Anthropic json_mode gap), and the public share-card regression — all discovered through live production testing.

---

## What We Did This Phase

### 1. Dead Code Removal — Debate + HTML Export

**Removed the Bull vs Bear debate and pitch-deck HTML export** — both features had been stripped from the UI in Phase 7 but their backend code was never cleaned up.

**What was removed:**
- `generate_debate()` and `generate_pitch_deck_html()` from `llm_client.py`
- `POST /sessions/{id}/debate` and `POST /sessions/{id}/pitch-deck/html` endpoints from `architect.py`
- `HTMLResponse` import and `generate_debate`/`generate_pitch_deck_html` imports in `architect.py`
- `debate` column from `db/models.py` and `ADD COLUMN IF NOT EXISTS debate` from `database.py`
- `"debate"` from the `_serialize()` in `sessions.py`
- `DebateRound`, `Debate` interfaces, `debate?` field, and `generateDebate` action from `sessionStore.ts`
- `DebateView.tsx` deleted via `git rm`

**Important distinction preserved:** The `debate` *scoring phase* (intake → debate → stress_test → masterplan) in `eval_bar.py`, `EvalBar.tsx`, and `SessionPage.tsx`'s phase stepper is a completely different concept and was NOT touched.

**Files changed:** `backend/llm_client.py`, `backend/api/routes/architect.py`, `backend/db/models.py`, `backend/db/database.py`, `backend/api/routes/sessions.py`, `frontend/src/store/sessionStore.ts`, `frontend/src/components/DebateView.tsx` (deleted)

---

### 2. Landing Page Marketing Copy Cleanup

The React landing page (`LandingPage.tsx`) still advertised two removed features: **Bull vs Bear Debate** and **Interactive HTML export**.

**What was removed/updated:**
- The 4-phase animated demo had a "④ Debate" phase — removed entirely. Demo now cycles Eval → Agents → Pitch (22.5s loop instead of 28s).
- `DemoPhase` type narrowed from `'eval' | 'agents' | 'pitch' | 'debate'` to `'eval' | 'agents' | 'pitch'`
- `DemoState` fields `showBull`, `showBear`, `showVerdict` removed
- `PHASE_TABS` "④ Debate" entry removed
- The Bull vs Bear JSX block in the demo removed
- The pitch slide's "Export as HTML →" badge changed to "9 slide-ready cards"
- Feature card "Bull vs Bear Debate" removed from the features grid
- Pitch deck card description updated (no more "Export as fully interactive HTML presentation")
- Proof row: "Bull vs Bear debate" → "Devil's advocate"
- Ticker: removed "Bull vs Bear debate" and "Interactive HTML export"
- Pricing "Full Analysis" checklist: removed "Bull vs Bear debate"

**Files changed:** `frontend/src/components/LandingPage.tsx`

---

### 3. CLAUDE.md — Full Codebase Documentation

The `CLAUDE.md` file was empty (1 line). Wrote a comprehensive codebase reference covering tech stack + versions, project structure, key pages and their purpose, all backend API routes, the LLM routing chain, the eval-bar scoring system, all environment variables (backend + frontend), how to run/build/deploy, code style conventions, and current known issues.

This is the primary reference document for future AI-assisted work on the codebase.

---

### 4. Identity-Based Admin Role

**Problem:** Testing required going through the full paid flow every time. The old bypass (`ADMIN_SECRET` header) was an open endpoint when the env var was unset — a security hole. There was no way to test on production without paying, and no way to distinguish "you" from "any random user who found the endpoint."

**Solution:** A real admin role tied to your **Clerk identity** (email-based allowlist).

**Backend changes:**
- `core/config.py` — `ADMIN_EMAILS` setting (comma-separated emails or Clerk user IDs). All string settings now strip on load (see Section 6).
- `core/auth.py` — new `is_admin()`: verifies Clerk JWT → resolves email via Clerk Backend API (cached per user ID) → checks allowlist. Also new `get_identity()` returning `{user_id, email, is_admin}`.
- `api/routes/me.py` — new `GET /me` returning `{user_id, email, is_admin}`. Frontend calls this on sign-in to learn admin status.
- `api/routes/sessions.py` — `admin-mark-paid` now gates on `is_admin()` (Bearer token) instead of `X-Admin-Secret` header. Admins bypass `_check_session_access`. `GET /sessions/?all=1` lets admins list all sessions.
- `api/routes/architect.py` — new `POST /sessions/{id}/admin-seed-conversation`: auto-plays a realistic multi-turn founder conversation (LLM answers its own questions with concrete numbers), generates the masterplan, and marks paid. One click to test masterplan **quality** (not just pipeline execution).
- `llm_client.py` — new `generate_founder_answer()` helper for the auto-play.

**Frontend changes:**
- `sessionStore.ts` — `isAdmin` state, `loadMe()` action, `setTokenGetter()`/`getFreshToken()` (see Section 7), `devSeedConversation()` action. Old `X-Admin-Secret` header removed from all admin actions.
- `App.tsx` — calls `loadMe()` after sign-in to populate `isAdmin`.
- `SessionPage.tsx` — dev/admin buttons gate on `isAdmin || !BILLING_ENABLED`. When `isAdmin` is true, buttons label as `[ADMIN]` instead of `[DEV]`. New "Quick-fill conversation" button triggers `devSeedConversation`.
- `TribunalPage.tsx` — same admin gating for the tribunal unlock dev button.

**One-time setup:** Set `ADMIN_EMAILS=ayush710yadav@gmail.com,user_3EA5O3ogG4Ym2ggMBxGDsZAVUgg` in Railway backend env. Sign in with that account → `[ADMIN]` buttons appear on prod, fully functional.

**When Clerk is unconfigured** (pure local dev with no keys): every request is treated as admin (matches the app's existing no-auth behavior).

**Files changed:** `backend/core/config.py`, `backend/core/auth.py`, `backend/api/routes/me.py` (new), `backend/api/routes/sessions.py`, `backend/api/routes/architect.py`, `backend/llm_client.py`, `backend/main.py`, `frontend/src/store/sessionStore.ts`, `frontend/src/App.tsx`, `frontend/src/components/SessionPage.tsx`, `frontend/src/components/TribunalPage.tsx`

---

### 5. Tribunal Auto-Send Race Fix

**Problem:** The tribunal page auto-sends the initial idea on mount. For a **signed-in** user on a cold page load, this fired before Clerk had finished loading and populating the auth token. The request hit the backend tokenless → `_check_session_access` failed on the owned session → 403 ("unresponsive" tribunal from the user's perspective).

**Fix:**
- Added `authReady` flag to the Zustand store.
- `ClerkSync` in `App.tsx` now waits for Clerk's `isLoaded` before signalling readiness, and sets `authReady` once auth is resolved (whether signed in or not).
- Tribunal's auto-send effect waits for `authResolved` (`!CLERK_ENABLED || authReady`) before firing, then re-runs when it flips.

| Case | Behavior |
|---|---|
| Clerk disabled | `authResolved` true immediately → sends right away |
| Signed out | Waits for Clerk load → sends tokenless → anonymous session ✓ |
| Signed in | Waits until token is fetched → sends with token → owned session ✓ |

**Files changed:** `frontend/src/store/sessionStore.ts`, `frontend/src/App.tsx`, `frontend/src/components/TribunalPage.tsx`

---

### 6. The Trailing Newline Bug (Strip All Settings)

**Problem (discovered during production testing):** The admin unlock was 403-ing even with a valid Clerk token and `ADMIN_EMAILS` set correctly. The actual failure was **earlier** in the chain: `token_ok: false` — every Clerk JWT was being rejected, so `is_admin` never got to check the allowlist.

**Root cause:** `CLERK_FRONTEND_API_URL` in Railway had a **trailing newline** appended by Railway's Variables tab when the value was pasted. The backend built the JWKS fetch URL as `https://precious-starling-67.clerk.accounts.dev\n/.well-known/jwks.json` — the fetch failed, the kid wasn't found, and every token was rejected. Auth was effectively dead for all owned sessions.

This is the exact same bug that broke the Groq key back in Phase 1. That was fixed for a few keys with `.strip()`. But Clerk URLs were never stripped.

**Fix:** Instead of fixing one key at a time, **strip every string setting** at load time so a pasted newline on any env var can never cause this class of bug again:

```python
for _field in (
    "groq_api_key", "anthropic_api_key", "google_api_key", "tavily_api_key",
    "openai_api_key", "clerk_secret_key", "clerk_frontend_api_url", "admin_secret",
    "admin_emails", "secret_key", "razorpay_key_id", "razorpay_key_secret",
    "razorpay_webhook_secret", "resend_api_key", "frontend_origin",
    "database_url", "redis_url",
):
    _v = getattr(_s, _field, "")
    if isinstance(_v, str):
        setattr(_s, _field, _v.strip())
```

**Diagnosed with** temporary diagnostics injected into `GET /me` and the `admin-mark-paid` 403 body (`clerk_url`, `verify_reason`, `token_ok` fields) — confirmed `clerk_url: "precious-starling-67.clerk.accounts.dev\n"` on prod, then stripped to `"precious-starling-67.clerk.accounts.dev"` after deploy.

**Files changed:** `backend/core/config.py`

---

### 7. Stale Clerk Token Bug (Fresh Token Per Request)

**Problem (another layer of the admin 403):** After the newline was fixed, the admin unlock *still* 403'd. Symptoms: `[ADMIN]` label showed (from `/me` on page load) but clicking unlock failed.

**Root cause:** Clerk session tokens expire in **~60 seconds** (confirmed from JWT: `exp − iat = 60`). The app fetched the token once on sign-in and only refreshed every **45 minutes** (written assuming 1-hour tokens). So `/me` ran with a fresh token → `[ADMIN]` showed. Minutes later the tribunal was done → the stored token was expired → the unlock used the dead token → backend rejected it → 403.

**Fix:** Store Clerk's `getToken` function as a `tokenGetter` in Zustand, then call it to fetch a **fresh** token right before every authenticated request:

```typescript
getFreshToken: async () => {
  const { tokenGetter, authToken } = get()
  if (tokenGetter) {
    const t = await tokenGetter()
    if (t) { set({ authToken: t }); return t }
  }
  return authToken
},
```

Applied to: `sendMessage`, `sendTribunalMessage`, `devUnlock`, `devUnlockTribunal`, `devRerunMasterplan`, `devSeedConversation`, `loadMe`, `loadSessionHistory`, `createSession`, `resumeSession`.

**Files changed:** `frontend/src/store/sessionStore.ts`, `frontend/src/App.tsx`

---

### 8. Tribunal Round Freeze

**Problem:** After round 1 completed, the tribunal froze — input accepted typing but the send did nothing. The UI was stuck with no way to recover.

**Root cause:** `_stream_llm_tokens` (the Anthropic streaming path) had no timeout. If the provider connection stalled mid-round (more common on the larger round-2 context), `async for text in stream.text_stream` blocked forever. `round_done` never fired, the SSE never closed, and the frontend's read loop blocked forever. `tribunalStreaming` stayed `true`, disabling the send button permanently.

**Two-layer fix:**

**Backend — per-persona timeout:**
```python
try:
    async with asyncio.timeout(60):
        async for token in _stream_llm_tokens(system, persona_msgs):
            content += token
            yield {"type": "persona_token", ...}
except (asyncio.TimeoutError, Exception) as e:
    if not content.strip():
        content = "(This judge couldn't respond this round — the others have spoken. You can continue.)"

yield {"type": "persona_done", ...}  # always emitted
yield {"type": "round_done"}  # always emitted
```

The key invariant: `persona_done` and `round_done` always fire regardless of what the provider does, so the SSE always closes.

**Frontend — 90s watchdog:**
```typescript
const controller = new AbortController()
const armWatchdog = () => {
  if (watchdog) clearTimeout(watchdog)
  watchdog = setTimeout(() => controller.abort(), 90000)
}
armWatchdog()  // armed on start, reset on every chunk
```

If no data arrives for 90s, the fetch is aborted, `tribunalStreaming` resets in `finally`, and the user sees: "The tribunal stalled — please send your message again." instead of a frozen screen.

**Files changed:** `backend/llm_client.py`, `frontend/src/store/sessionStore.ts`

---

### 9. Tribunal Verdicts — "Analysis unavailable — API error"

**Problem:** After the admin unlock finally worked, all three verdicts showed "Analysis unavailable — API error" (score 50, FAIL for all, even though the conversation was substantive).

**Root cause:** `_call_anthropic` ignores `json_mode` — Anthropic has no `response_format: {type: "json_object"}` parameter. On Google and Groq, `json_mode=True` forced clean JSON output. On Anthropic (your prod primary), the prompt's "Think through your reasoning first, then return ONLY valid JSON" instruction was followed literally: Haiku emitted **prose reasoning + JSON**. Then `json.loads(raw)` on the whole blob threw `JSONDecodeError` → caught → hardcoded "Analysis unavailable" fallback for all three judges.

**Three fixes:**

1. **Robust JSON parsing** — new `_parse_json_object()` helper that strips markdown fences and extracts the `{...}` block with a regex if `json.loads` fails:

```python
def _parse_json_object(raw: str) -> dict:
    text = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise
```

2. **JSON-only prompt** — changed "Think through your reasoning first, then return ONLY valid JSON" to "Return ONLY a valid JSON object, no preamble or commentary before or after it". Also bumped `max_tokens` 500 → 800 and appended a final user-role trigger message so the model actually produces the verdict.

3. **`_call_real_llm` fallback** — Anthropic was the only provider with **no fallback** (if it threw, the error propagated straight to the `except` block). Added try/except around the Anthropic call, with automatic fallthrough to Google → Groq on any error.

**Files changed:** `backend/llm_client.py`

---

### 10. Share Verdict Card Regression

**Problem:** After the fresh-token fix in Section 7 correctly identified signed-in users as session owners, the public "Share verdict card →" link broke. The `/card/:id` page calls `GET /sessions/{id}` with no auth token (it's a public page), which now 403'd for owned sessions because `_check_session_access` saw no token and session had a `user_id`.

**Why it worked before:** When tokens were expired/stale, sessions were effectively anonymous from the backend's perspective — no user was identified. Fixing auth "broke" the public card as a side effect.

**Fix:** Made `GET /sessions/{id}` fully public (read-by-UUID). The session UUID is a randomly-generated unguessable capability — anyone with the link should be able to read it (that's the entire point of sharing). Only **mutations** need ownership/admin gating:

```python
@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    # Public read-by-UUID: session UUID is an unguessable capability.
    # Mutations (messages, unlock, admin actions) remain ownership/admin-gated.
    ...
```

**Files changed:** `backend/api/routes/sessions.py`

---

### 11. Diagnostic Cleanup

Temporary debugging was added to `/me` and the `admin-mark-paid` 403 body during the investigation (fields like `admin_count`, `token_ok`, `email_source`, `clerk_url`, `verify_reason`, and `debug={_ident}` in the error response). All removed from production once the auth chain was confirmed working.

---

## Architecture After Phase 8

No structural changes from Phase 7. The LLM pipeline, page flow, and database schema are unchanged. What changed:

```
Admin identity:
  Clerk JWT → _verify_token() → get user_id
    → _fetch_clerk_email(user_id) [cached, Clerk Backend API]
    → check email/user_id against ADMIN_EMAILS allowlist
    → is_admin: true/false

Token freshness:
  Every authenticated request → getFreshToken() → Clerk getToken()
    → fresh ~60s Clerk token (never uses stale cached token)

Tribunal round safety:
  Each persona stream → asyncio.timeout(60)
    → always emits persona_done + round_done (SSE always closes)
  Frontend: 90s watchdog AbortController
    → recovers even if backend is completely unresponsive

Verdict parsing:
  _call_real_llm() → Anthropic [try] → Google [try] → Groq
  Response → _parse_json_object() → strips prose/fences → extracts {}
```

---

## Key Bugs and Root Causes

| Bug | Root Cause | Fix |
|---|---|---|
| Admin 403 (layer 1) | `\n` in Railway `CLERK_FRONTEND_API_URL` broke JWKS URL | Strip all string settings on load |
| Admin 403 (layer 2) | 60s Clerk tokens reused for 45 min | `getFreshToken()` — fresh token per request |
| Tribunal round freeze | No timeout on Anthropic stream → SSE never closed | `asyncio.timeout(60)` + 90s frontend watchdog |
| Verdicts all "API error" | Anthropic ignores `json_mode`; prose+JSON failed `json.loads` | Robust `_parse_json_object()` + JSON-only prompt |
| Share card 403 | Auth fix correctly identified session owners; public card had no auth | `GET /sessions/{id}` is public-by-UUID |
| Tribunal auto-send 403 | Auto-sent before Clerk token populated (cold load) | Gate on `authReady` — wait for Clerk `isLoaded` |

---

## Concepts Learned This Phase

### Stacked bugs compound diagnosis time
The admin 403 had **three independent root causes**: the Clerk URL newline (broke all token verification), the 60s token reuse (tokens expired before use), and the public session read (needed auth the card page doesn't send). Fixing layer 1 exposed layer 2, which exposed layer 3. Each fix was correct; the symptom ("403 on admin unlock") looked identical each time.

### Trailing newlines in hosting dashboards
This is the second time a pasted env var in Railway appended an invisible `\n` and broke something. The first was the Groq API key in Phase 1. The fix is to strip at load time, not in the dashboard — dashboards change, code stays.

### Clerk session tokens are ~60 seconds
Clerk's default session token TTL is ~60 seconds (observable in the JWT: `exp - iat = 60`). The app was written assuming 1-hour tokens (hence the 45-minute refresh interval). This caused every signed-in request after 60 seconds to use an expired token. Calling Clerk's `getToken()` per-request is the correct pattern — Clerk caches the underlying session server-side and only issues a new token if needed (cheap call).

### Anthropic has no json_mode
Unlike OpenAI, Google, and Groq, Anthropic's API has no `response_format: {type: "json_object"}`. LLM instructions alone ("return ONLY valid JSON") are unreliable — especially with reasoning-capable models that follow "think first, then output" literally. The robust pattern: parse defensively with a regex fallback that extracts the `{...}` block from whatever the model outputs.

### Public share by unguessable UUID
The original design of `GET /sessions/{id}` included an access check, which is correct for privacy of owned sessions. But the shareable card is a deliberate "anyone with the link" feature — the UUID is the access control. The fix (making the GET fully public) is correct; it matches how the share/compare/card pages were always intended to work. Mutations stay locked.

---

## What's Next

| Priority | Task |
|---|---|
| High | UI/UX redesign — full visual overhaul (dark, editorial, premium feel) |
| High | Set up cron-job.org → `POST /admin/send-follow-ups` daily |
| High | Buy custom domain → verify in Resend → update `from` address |
| Medium | Socra should answer direct questions (not locked in interrogation mode only) |
| Medium | Outcome tracking — "I built it / pivoted / moved on" captures real outcomes |
| Medium | Anonymous → authenticated session migration on sign-in |
| Medium | Backend session ownership check on mutations for anonymous sessions |
| Low | Hybrid model routing — Sonnet for synthesis + verdicts, Haiku for everything else |
| Low | Anthropic `cache_control` on shared prompt prefix |
| Low | Analytics — PostHog / Plausible for session start, payment, verdict events |
