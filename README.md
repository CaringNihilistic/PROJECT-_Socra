# Socra — AI Startup Evaluator

> An AI that refuses to give you a masterplan until it fully understands your idea. It interrogates founders Socratically, scores the idea across 5 dimensions, then unlocks a multi-agent council analysis and a synthesized Chairman's Masterplan. A second mode — the **Tribunal** — puts the idea on trial before 3 adversarial judges who deliver Pass/Fail verdicts.

---

## What It Does

Most AI tools tell you what you want to hear. Socra doesn't.

It runs founders through a structured Socratic interrogation — asking targeted questions, challenging vague answers, and scoring their idea across 5 dimensions in real time. Only when the idea is fully understood does it unlock a specialist council of 5 AI advisors, each analyzing a different aspect of the business, followed by a synthesized masterplan from "The Chairman."

**Standard Mode:** Socratic Q&A → Eval scoring → Council of 5 agents → Chairman's Masterplan  
**Tribunal Mode:** 3 adversarial judges (Investor, Customer, Competitor) interrogate the founder over 4 rounds, then deliver Pass/Fail verdicts with scores

---

## Core Features

### Socratic Interrogation
- Maximum 2 targeted questions per turn — no rambling
- Challenges vague answers ("reduce costs" → "by how much exactly?")
- Scores progress across 5 dimensions in real time
- Phases: `intake` → `debate` → `stress_test` → `masterplan`

### The Eval Bar (5 Dimensions)
| Dimension | Weight |
|---|---|
| Problem Clarity | 25% |
| Scale & Constraints | 20% |
| Tech Context | 20% |
| Success Definition | 20% |
| Risk Awareness | 15% |

### Council of 5 Specialist Agents
Runs in parallel once the eval threshold is reached:
- 💼 **The Banker** — unit economics, CAC/LTV, burn rate, funding gap
- 🔮 **The Oracle** — market sizing, GTM, timing risk
- ⚔️ **The Challenger** — named competitors, moat analysis, copy risk
- 🔧 **The Builder** — tech stack, build vs buy, what breaks at 10x
- 🎯 **The Skeptic** — regulation, platform dependencies, killer assumptions
- 💀 **Devil's Advocate** — 5 specific critiques of the masterplan itself

### Chairman's Masterplan
Synthesizes all 5 council reports into a definitive plan: tech stack table, 3 implementation phases, risk register with specific mitigations, first 3 files to write.

### Tribunal Mode
3 adversarial personas interrogate the founder over 4 rounds, each from their own perspective. After round 4:
- Each judge delivers a Pass/Fail verdict with a score (0–100) and rubric
- Composite grade: GREENLIT / STRONG / CHALLENGED / REJECTED
- Shareable verdict card

### Shareable Links
- `/card/:id` — public score card (dimensions + phase)
- `/share/:id` — read-only masterplan view
- `/compare/:id1/:id2` — side-by-side session comparison

### Live Market Research
Tavily web search runs before council analysis to ground agent reports in current market data.

---

## Tech Stack

### Backend
| Component | Choice |
|---|---|
| Framework | FastAPI + Uvicorn |
| Language | Python 3.11 |
| Database | PostgreSQL (SQLAlchemy asyncio + asyncpg) |
| Agent orchestration | LangGraph (StateGraph, parallel fan-out, Postgres checkpointing) |
| Cache | Redis |
| Auth | Clerk (JWT verification via python-jose) |
| Payments | Razorpay |
| Observability | Langfuse v4 |
| Web search | Tavily |
| HTTP client | httpx |

### LLM Routing
All calls route through `backend/llm_client.py` with automatic fallback:
1. **Anthropic Haiku 4.5** (`claude-haiku-4-5-20251001`) — primary
2. **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) — fallback
3. **Groq** (`llama-3.1-8b-instant`) — final fallback

The council of 5 agents can also run through a **LangGraph pipeline** — user-selectable before unlocking. Benchmarked 16% faster (52s vs 62s) at identical cost.

### Frontend
| Component | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Fonts | Bricolage Grotesque + Onest + DM Mono |
| State | Zustand |
| Auth | @clerk/clerk-react |

### Infrastructure
- **Hosting:** Railway (backend + frontend as separate services)
- **Local dev:** Docker Compose

---

## Project Structure

```
socra/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting, /health
│   ├── llm_client.py            # LLM routing, council agents, tribunal, masterplan
│   ├── observability.py         # Langfuse v4 tracing (optional)
│   ├── eval_bar.py              # 5-dimension scoring + phase thresholds
│   ├── web_search.py            # Tavily live market research
│   ├── llm_graph/
│   │   ├── council_graph.py     # LangGraph StateGraph — parallel 5-agent council
│   │   └── checkpointer.py      # AsyncPostgresSaver (resilience — resumes on failure)
│   ├── core/
│   │   ├── config.py            # Settings via pydantic-settings
│   │   └── auth.py              # Clerk JWT verification + admin role
│   ├── db/
│   │   ├── database.py          # Async engine + session
│   │   └── models.py            # Session + WaitlistEntry tables
│   └── api/routes/
│       ├── sessions.py          # Session CRUD + admin endpoints
│       ├── architect.py         # Streaming chat, unlock, masterplan, tribunal
│       ├── billing.py           # Razorpay checkout / webhook / verify
│       ├── waitlist.py          # Email waitlist
│       ├── followup.py          # Follow-up email capture
│       └── me.py                # GET /me — identity + is_admin
├── frontend/
│   └── src/
│       ├── App.tsx              # Path-based routing, Clerk provider
│       ├── store/sessionStore.ts # Zustand store — all state + SSE streaming
│       └── components/
│           ├── LandingPage.tsx  # Entry — idea input, examples, mode selection
│           ├── SessionPage.tsx  # Standard mode: Chat → Council → Masterplan
│           ├── TribunalPage.tsx # Tribunal mode: 3 judges → verdicts
│           ├── CardPage.tsx     # Public score card (/card/:id)
│           ├── SharePage.tsx    # Public masterplan view (/share/:id)
│           └── ComparePage.tsx  # Side-by-side comparison (/compare/:id1/:id2)
├── docker-compose.yml
└── .env.example
```

---

## Getting Started

### Prerequisites
- Docker + Docker Compose (recommended)
- Anthropic API key (or Google/Groq as fallback)

### Local Development

```bash
git clone https://github.com/CaringNihilistic/PROJECT-_Socra.git
cd PROJECT-_Socra

cp .env.example .env
# Add your ANTHROPIC_API_KEY and set STUB_MODE=false

docker compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

`STUB_MODE=true` (default) runs offline with canned responses for the 3 landing page example ideas — no API key needed to try it.

### Backend Only

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Only

```bash
cd frontend
npm install
npm run dev
```

### Key Environment Variables

```env
# LLM (at least one required for real responses)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=            # Gemini fallback
GROQ_API_KEY=              # Groq fallback

STUB_MODE=false            # true = offline demo (landing page examples only)

# Database
DATABASE_URL=postgresql://socra:socra_dev@postgres:5432/socra_db
REDIS_URL=redis://redis:6379

# Auth (Clerk) — optional for local dev
CLERK_SECRET_KEY=
CLERK_FRONTEND_API_URL=

# Payments (Razorpay) — leave unset to show [DEV] bypass buttons
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Live market research
TAVILY_API_KEY=

# Observability (optional)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=

# Admin access (comma-separated Clerk emails)
ADMIN_EMAILS=you@example.com
```

---

## How It Works

```
Founder submits idea
        ↓
Socratic interrogation (2-3 questions/turn, max ~8 turns)
Eval bar scores 5 dimensions in real time
        ↓
Score > 80%?
   No → Keep questioning
   Yes → Payment gate
        ↓
[Payment or admin bypass]
        ↓
Parallel council: 5 agents run simultaneously
Live web research enriches each report
        ↓
Chairman synthesizes → Masterplan
Devil's Advocate critiques it
        ↓
Optional: Tribunal (3 judges × 4 rounds → Pass/Fail verdicts)
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/` | Create session |
| GET | `/sessions/{id}` | Get session (public by UUID) |
| POST | `/sessions/{id}/message/stream` | SSE Socratic chat |
| POST | `/sessions/{id}/unlock` | Run council + masterplan (SSE); `?use_langgraph=true` for LangGraph pipeline |
| POST | `/sessions/{id}/tribunal/message` | SSE tribunal round |
| POST | `/sessions/{id}/tribunal/unlock` | Generate verdicts |
| POST | `/billing/checkout` | Razorpay checkout |
| POST | `/billing/verify` | Verify payment |
| GET | `/me` | Current identity + is_admin |
| GET | `/health` | DB + Langfuse + checkpointer status |

---

## Deployment

Deployed on Railway. Push to `main` → auto-build via Dockerfiles.

Backend env vars are set in the Railway backend service. Frontend `VITE_*` vars are set in the Railway frontend service and are baked in at build time — changing them requires a rebuild.

---

## License

MIT
