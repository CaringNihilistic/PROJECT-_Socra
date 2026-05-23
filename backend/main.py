from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db.database import init_db
from api.routes import sessions, architect, waitlist
from core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print(f"🧠 Socra started — Stub mode: {settings.is_stub}")
    if settings.is_stub:
        print("⚠️  Running in STUB MODE — no real LLM calls.")
        print("    → Set GROQ_API_KEY (free at console.groq.com) or ANTHROPIC_API_KEY + STUB_MODE=false to go live.")
    elif settings.anthropic_api_key:
        print("✅ Using Anthropic Claude Sonnet 4-6")
    elif settings.groq_api_key:
        print("✅ Using Groq (LLaMA 3.3 70B)")
    yield


app = FastAPI(
    title="Socra API",
    description="The AI Architect that refuses to answer until it fully understands.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://socra-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(architect.router)
app.include_router(waitlist.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "stub_mode": settings.is_stub,
        "version": "0.1.0",
    }
