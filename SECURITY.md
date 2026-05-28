# Socra — Security & Production Hardening

> Written after full audit of all backend routes and a dedicated API key leak audit. Every item below is already implemented and deployed. This document exists so future contributors understand *why* each guard is there and what breaks if it's removed.

---

## What Was Audited

All five backend route files (`sessions.py`, `architect.py`, `billing.py`, `followup.py`, `waitlist.py`), the auth layer (`core/auth.py`), the database engine (`db/database.py`), the app entrypoint (`main.py`), all frontend `VITE_` env vars, the entire git history for committed secrets, and the Docker build context.

---

## Fixes Shipped (commit `4f23caf`)

### 1. IDOR — Session Ownership Checks

**File:** `backend/api/routes/sessions.py` → `_check_session_access()`  
**Also applied to:** every endpoint in `architect.py` and `followup.py`

**What it is:** Insecure Direct Object Reference. Session IDs are UUIDs — long and random, but not secret. They appear in `localStorage`, Railway logs, browser history, and referrer headers. Anyone who obtains one could previously read the full session: masterplan, follow-up email address, tribunal verdicts, conversation history.

**The fix:**
```python
async def _check_session_access(session: Session, authorization: Optional[str]) -> None:
    if not session.user_id:
        return  # anonymous session — UUID is the only gate
    requesting_user = await get_user_id(authorization)
    if requesting_user != session.user_id:
        raise HTTPException(403, "Access denied")
```

**Rule:** If a session belongs to an authenticated user (`user_id` set), only that user's Clerk JWT can access it. Anonymous sessions (`user_id = None`) remain UUID-gated — there is no other identity to check against.

**Endpoints protected:**
- `GET /sessions/{id}`
- `POST /sessions/{id}/message`
- `POST /sessions/{id}/message/stream`
- `POST /sessions/{id}/unlock`
- `POST /sessions/{id}/pitch-deck`
- `POST /sessions/{id}/pitch-deck/html`
- `POST /sessions/{id}/debate`
- `POST /sessions/{id}/tribunal/message`
- `POST /sessions/{id}/tribunal/unlock`
- `POST /sessions/{id}/follow-up`

---

### 2. Open Redirect — `success_url` Validation in Billing

**File:** `backend/api/routes/billing.py` → `_validate_callback_url()`

**What it is:** The `/billing/checkout` endpoint accepts a `success_url` from the frontend and passes it directly to Razorpay as the `callback_url`. Razorpay redirects the user there after payment. An attacker could POST a crafted request with `success_url: "https://evil.com"` and Razorpay would deliver the user (and payment confirmation params) to that domain.

**The fix:**
```python
_ALLOWED_CALLBACK_HOSTS = {
    "localhost",
    "127.0.0.1",
    "socra-production.up.railway.app",
}

def _validate_callback_url(url: str) -> None:
    parsed = urlparse(url)
    if (parsed.hostname or "") not in _ALLOWED_CALLBACK_HOSTS:
        raise HTTPException(400, "Invalid success_url domain")
```

**When adding a custom domain:** add it to `_ALLOWED_CALLBACK_HOSTS`.

---

### 3. Input Length Limits

**Files:** `sessions.py` (`CreateSessionRequest`), `architect.py` (`MessageRequest`)

**What it is:** Without limits, a single request with a 10 MB `idea` string triggers an expensive LLM call, stores a huge DB row, and occupies a worker for the full LLM latency. One person with a script could exhaust the monthly API budget in minutes.

**The fix:**
```python
class CreateSessionRequest(BaseModel):
    idea: str = Field(..., min_length=1, max_length=2000)

class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
```

FastAPI/Pydantic rejects oversized payloads with a `422` before any DB or LLM call is made.

---

### 4. Email Validation on Follow-Up Endpoint

**File:** `backend/api/routes/followup.py`

**What it was:** `email: str` — any string accepted, stored directly in DB, later passed to Resend API.

**The fix:**
```python
from pydantic import EmailStr

class FollowUpEmailRequest(BaseModel):
    email: EmailStr
```

Pydantic's `EmailStr` (backed by `email-validator`) rejects malformed addresses at the request boundary. The field is also explicitly cast to `str` before DB write: `session.follow_up_email = str(req.email)`.

**Dependency added:** `email-validator==2.1.0` in `requirements.txt`.

---

### 5. CORS Locked to Specific Origin

**File:** `backend/main.py`

**What it was:**
```python
allow_origin_regex=r"https://.*\.up\.railway\.app|http://localhost:(3000|5173)"
```
This allowed *any* Railway-hosted app to make credentialed cross-origin requests to the Socra API — not just the Socra frontend.

**The fix:**
```python
_allowed_origins = [
    settings.frontend_origin,   # set FRONTEND_ORIGIN on Railway
    "http://localhost:3000",
    "http://localhost:5173",
]
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, ...)
```

**Railway env var required (backend service):**
```
FRONTEND_ORIGIN = https://socra-production.up.railway.app
```
Without this var, the setting defaults to `http://localhost:5173`, which will block the production frontend. Set it before the next deploy.

---

### 6. Rate Limiting (Per-IP, In-Memory)

**File:** `backend/main.py` → `RateLimitMiddleware`

**What it is:** Without rate limiting, a single IP can spam `POST /sessions/` continuously, triggering an LLM call per request and burning the API budget. No new infrastructure is needed — a middleware with a rolling time window handles it.

**Limits:**
| Endpoint | Limit |
|----------|-------|
| `POST /sessions/` (session creation) | 10 requests / minute / IP |
| All other `POST` endpoints | 60 requests / minute / IP |

**Response on breach:** `429 Too Many Requests` with `Retry-After: 60` header.

**Tradeoff:** In-memory store resets on restart and doesn't coordinate across multiple instances. Acceptable for a single-instance Railway deployment. If horizontal scaling is added, replace with a Redis-backed counter (the middleware structure makes this a 20-line change).

---

### 7. Global Error Handler

**File:** `backend/main.py`

**What it was:** FastAPI's default 500 handler can include stack traces and internal variable names in responses under certain configurations.

**The fix:**
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[ERROR] {request.method} {request.url.path} → {type(exc).__name__}: {exc}")
    traceback.print_exc()
    return JSONResponse({"detail": "Internal server error"}, status_code=500)
```

Full stack traces go to Railway logs (visible to you). Clients receive only `{"detail": "Internal server error"}`.

---

### 8. Database Health Check

**File:** `backend/main.py` → `GET /health`

**What it was:** `/health` returned `200 ok` regardless of database state — Railway's health check would pass even if Postgres was down.

**The fix:**
```python
async with engine.begin() as conn:
    await conn.execute(text("SELECT 1"))
db_ok = True
```

Returns `"status": "degraded"` with the DB error logged if the connection fails. Railway's health check will see a non-`ok` status and can trigger a restart or alert.

---

### 9. Database Connection Pool Sizing

**File:** `backend/db/database.py`

**What it was:**
```python
create_async_engine(db_url, echo=False, pool_pre_ping=True)
```
SQLAlchemy's default pool is 5 connections with 10 overflow. Under modest concurrent load (10+ simultaneous SSE streams) this exhausts silently — new requests hang waiting for a connection rather than failing fast.

**The fix:**
```python
create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
)
```

Supports 30 concurrent DB operations before queuing, with a 30-second timeout before raising `TimeoutError` instead of hanging indefinitely.

---

## API Key Leak Audit (commit `d436df2`)

A dedicated audit of every path through which API keys could be exposed — git history, browser source, Docker image, logs, and public endpoints.

### Finding 1: `/health` exposed configuration details

**What it was:**
```json
{
  "status": "ok",
  "stub_mode": false,
  "llm": "google",
  "env_google_key_set": true,
  "settings_google_key_set": true
}
```
No key *values* were exposed, but the endpoint told any visitor: which LLM provider is configured, whether keys are present, and whether the app is in production or demo mode. This is a targeted attack primer — an attacker now knows exactly which API to attempt to steal or exhaust.

**The fix:** Stripped to only what a health check needs:
```json
{ "status": "ok", "db": "ok", "version": "0.2.2" }
```

---

### Finding 2: Startup log printed key lengths

**What it was:**
```
🔑 ENV check — GOOGLE_API_KEY: SET(39 chars), GROQ_API_KEY: SET, STUB_MODE: false
```
This went to Railway logs on every deploy. Key length narrows brute-force search space and confirms which keys are active. Anyone with Railway log access (a compromised account, a contractor) could see it.

**The fix:** Startup now logs only the provider name, never key presence or length:
```
✅ Socra: LLM ready (Google)
```

---

### Finding 3: No `.dockerignore` in backend

**What it was:** `backend/Dockerfile` runs `COPY . .` with no `.dockerignore`. If anyone ever created a `backend/.env` file (easy mistake when debugging locally), it would be silently baked into the Docker image — then extractable from any container artifact, CI cache, or Railway build log.

**The fix:** Created `backend/.dockerignore`:
```
.env
.env.*
__pycache__/
*.py[cod]
...
```

---

### Finding 4: `.env` file has real keys locally

**Status: Safe — not in git.** Verified with `git log --all -S "<key_value>"` for every key in `.env`. No key values appear anywhere in the git history.

**How it stays safe:** `.gitignore` has `.env` and `.env.*` excluded. The `backend/.dockerignore` (new) prevents it entering Docker images. Railway reads keys from environment variables, never from a file.

**Risk that remains:** The `.env` file exists on the developer's local machine with real keys. If that machine is compromised or the file is accidentally shared (zip, email, screenshot), keys are exposed. Mitigation: use a password manager or secret vault (1Password, Doppler) for local dev keys instead of a plaintext file.

---

### What's visible via browser F12 (source code search)

Searched every `VITE_` env var in the frontend bundle:

| Variable in bundle | Value type | Dangerous? |
|--------------------|-----------|------------|
| `VITE_API_URL` | Backend URL (`https://socra-production.up.railway.app`) | No — already public |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | No — publishable keys are *designed* to be public. Identifies the app, grants no access. |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_...` (if set) | No — Razorpay key IDs are public, equivalent to Stripe's `pk_live_`. The secret lives in backend only. |

**Keys that never reach the browser:**
`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`, `RESEND_API_KEY`, `SECRET_KEY`, `DATABASE_URL`

All of these live exclusively in `backend/core/config.py` → Railway env vars → never serialized into any API response or frontend bundle.

**The rule that keeps this safe:** Anything in `backend/core/config.py` never touches the frontend. Any `VITE_` prefixed variable is either a URL or an intentionally public key. Never put a server-side secret in a `VITE_` variable.

---

## What Remains Solid (No Changes Needed)

| Mechanism | Why it's fine |
|-----------|--------------|
| Razorpay webhook HMAC (`hmac.compare_digest`) | Constant-time comparison, correct key usage |
| Payment unlock checks `session.paid` server-side | Not client-controlled — only the webhook or verify endpoint can set it |
| Clerk JWT via JWKS with 1-hour cache | Industry standard, keys auto-rotated by Clerk |
| Admin endpoint (`/admin/send-follow-ups`) behind `X-Admin-Secret` | Acceptable for internal cron use; not user-facing |
| `pool_pre_ping=True` on DB engine | Recycles stale connections before use |
| Idempotent unlock endpoints | Safe to call multiple times — DB is the source of truth |

---

## Remaining Gaps (Not Yet Fixed)

These are known and acceptable for current scale. Fix before significant user growth.

| Gap | Risk | Recommended Fix |
|-----|------|----------------|
| No LLM call timeout | A hung Anthropic/Groq request ties up a worker indefinitely | Wrap `_call_real_llm` in `asyncio.wait_for(coro, timeout=90)` |
| SSE streams continue after client disconnect | Wasted LLM tokens when users close the tab mid-stream | Use `await request.is_disconnected()` in the generator loop |
| Admin secret = SECRET_KEY | Rotating SECRET_KEY breaks cron-job.org without a config update | Add a dedicated `admin_secret` env var in config |
| No request body size limit | Very large JSON bodies (not just the `idea` field) still accepted | Add `app.add_middleware(TrustedHostMiddleware)` or Nginx `client_max_body_size` |
| Rate limit doesn't survive restarts | In-memory — a restart resets all counters | Replace `defaultdict` with Redis counters when scaling |

---

## Environment Variables Checklist

All backend env vars that must be set on Railway for production:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SECRET_KEY` | Yes | JWT signing + admin endpoint auth |
| `FRONTEND_ORIGIN` | **Yes (new)** | CORS allowlist — set to Railway frontend URL |
| `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY` or `GROQ_API_KEY` | Yes | LLM provider |
| `STUB_MODE` | Set to `false` | Disable stub mode in production |
| `RAZORPAY_KEY_ID` | Yes (billing) | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Yes (billing) | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes (billing) | Webhook HMAC verification |
| `CLERK_SECRET_KEY` | Yes (auth) | Clerk JWT verification |
| `CLERK_FRONTEND_API_URL` | Yes (auth) | Clerk JWKS endpoint |
| `RESEND_API_KEY` | Yes (email) | 90-day follow-up emails |
| `TAVILY_API_KEY` | Optional | Web research in agent pipeline |
