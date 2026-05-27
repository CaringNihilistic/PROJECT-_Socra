# Socra — Security & Production Hardening

> Written after full audit of all backend routes. Every item below is already implemented and deployed. This document exists so future contributors understand *why* each guard is there and what breaks if it's removed.

---

## What Was Audited

All five backend route files (`sessions.py`, `architect.py`, `billing.py`, `followup.py`, `waitlist.py`), the auth layer (`core/auth.py`), the database engine (`db/database.py`), and the app entrypoint (`main.py`).

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
