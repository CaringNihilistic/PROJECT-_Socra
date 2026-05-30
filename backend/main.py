import time
import json
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from db.database import init_db, engine
from api.routes import sessions, architect, waitlist, billing, followup, me
from core.config import settings


# ---------------------------------------------------------------------------
# Rate limit middleware (in-memory, per-IP, no extra package needed)
# ---------------------------------------------------------------------------
class RateLimitMiddleware(BaseHTTPMiddleware):
    # Tighter limit for session creation; looser for everything else
    _CREATE_SESSION_LIMIT = 10   # per minute
    _GENERAL_LIMIT = 60          # per minute
    _WINDOW = 60.0               # seconds

    def __init__(self, app):
        super().__init__(app)
        self._store: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST":
            ip = (request.client.host if request.client else "unknown")
            path = request.url.path
            now = time.monotonic()

            limit = self._CREATE_SESSION_LIMIT if path == "/sessions/" else self._GENERAL_LIMIT
            key = f"{ip}:{path}"

            self._store[key] = [t for t in self._store[key] if now - t < self._WINDOW]
            if len(self._store[key]) >= limit:
                return JSONResponse(
                    {"detail": "Too many requests — please slow down"},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
            self._store[key].append(now)

        return await call_next(request)


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.is_stub:
        print("⚠️  Socra: STUB MODE — no real LLM calls")
    elif settings.anthropic_api_key:
        print("✅ Socra: LLM ready (Anthropic)")
    elif settings.google_api_key:
        print("✅ Socra: LLM ready (Google)")
    elif settings.groq_api_key:
        print("✅ Socra: LLM ready (Groq)")
    else:
        print("⚠️  Socra: no LLM API key set — calls will fail")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Socra API",
    description="The AI Architect that refuses to answer until it fully understands.",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting must come before CORS so blocked requests don't waste CORS processing
app.add_middleware(RateLimitMiddleware)

# CORS — locked to specific frontend origin, not a wildcard Railway regex
_allowed_origins = [
    settings.frontend_origin,
    "http://localhost:3000",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(architect.router)
app.include_router(waitlist.router)
app.include_router(billing.router)
app.include_router(followup.router)
app.include_router(me.router)


# ---------------------------------------------------------------------------
# Global error handler — never leak stack traces to the client
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[ERROR] {request.method} {request.url.path} → {type(exc).__name__}: {exc}")
    traceback.print_exc()
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


# ---------------------------------------------------------------------------
# Health check — tests the actual DB connection
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    from sqlalchemy import text

    db_ok = False
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        print(f"[HEALTH] DB check failed: {e}")

    return {
        "status": "ok" if db_ok else "degraded",
        "db": "ok" if db_ok else "error",
        "version": "0.2.2",
    }
