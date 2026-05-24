# Socra — Build Journal

> An AI architect that uses Socratic dialogue to interrogate your project idea before generating architecture.
> Live at: **https://socra-production.up.railway.app**

---

## What We Built

Socra is a full-stack web app where you describe a project idea, and an AI asks you progressively harder questions — about scale, constraints, risk, success criteria — before it will generate an architecture plan. It refuses to answer until it truly understands the problem.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python + FastAPI |
| Database | PostgreSQL (via SQLAlchemy async) |
| Cache | Redis |
| AI | Groq API — LLaMA 3.3 70B (free, no credit card) |
| Auth | Clerk (JWT-based, optional) |
| Deployment | Railway (backend + frontend + postgres + redis) |
| State management | Zustand |
| Streaming | Server-Sent Events (SSE) |

---

## Features Implemented

### Core AI Flow
- **Socratic interrogation**: AI asks targeted questions across 5 dimensions before generating output
- **5-dimension eval bar**: Real-time score across Problem Clarity, Scale & Constraints, Tech Context, Success Definition, Risk Awareness
- **Phase progression**: intake → debate → stress_test → masterplan (unlocks at 85% total score)
- **Assumption tracker**: AI surfaces hidden assumptions as collapsible pill tags, auto-expands when new ones are added
- **Architecture masterplan**: Full markdown document generated when score threshold is met
- **Markdown export**: Download the masterplan as a `.md` file

### Streaming
- Responses stream word-by-word with an amber cursor `▌` while typing
- Dots animation shown while waiting for first token

### Authentication (Clerk)
- Sign in / sign up via Clerk
- Signed-in users: session history stored in PostgreSQL backend
- Anonymous users: session history stored in localStorage
- Graceful degradation — app works fully without Clerk keys

### Waitlist
- Email capture form on the landing page
- Emails saved to PostgreSQL `waitlist` table
- Duplicate emails handled silently
- Query saved emails: `docker compose exec postgres psql -U socra -d socra_db -c "SELECT * FROM waitlist;"`

### Landing Page
- Sticky nav with auth button
- Hero section with glass input card
- CSS ticker/marquee of use cases
- Animated live demo (auto-cycling eval bar)
- Problem comparison (Without Socra vs With Socra)
- 6 feature cards
- Pricing section (₹0 Free / ₹999 Pro / ₹3499 Team)
- Waitlist email capture
- Footer

### Session Page
- Sticky header with truncated idea title
- AI messages: clean prose, amber "S" avatar
- User messages: glass bubble
- Masterplan rendered in emerald card with export button
- Input locked after masterplan is generated

---

## Architecture

```
Browser
  └── React frontend (Vite)
        ├── Zustand store (state + API calls)
        ├── Clerk (auth, optional)
        └── SSE streaming reader

FastAPI backend
  ├── POST /sessions/          — create session + fire first LLM turn
  ├── POST /sessions/{id}/message/stream  — SSE streaming responses
  ├── GET  /sessions/          — list user's sessions (auth required)
  ├── GET  /sessions/{id}      — fetch single session
  ├── POST /waitlist           — save email signup
  └── GET  /health             — health check

PostgreSQL
  ├── sessions table           — all session state + conversation history
  └── waitlist table           — email signups

Redis                          — available for caching (not yet used)

Groq API (external)            — LLaMA 3.3 70B for LLM responses
```

---

## LLM Routing Priority

1. **Anthropic Claude** — if `ANTHROPIC_API_KEY` is set
2. **Groq (LLaMA 3.3 70B)** — if `GROQ_API_KEY` is set (free at console.groq.com)
3. **Stub mode** — 3 demo scenarios matched by keyword (api_docs / ml_marketplace / grocery)

---

## Stub Demo Scenarios

When no API key is set, Socra has 3 built-in demo conversations:
- **API docs platform** — triggered by keywords like "api", "docs", "documentation"
- **ML marketplace** — triggered by keywords like "ml", "machine learning", "marketplace"
- **Grocery app** — triggered by keywords like "grocery", "receipt", "price"

Each scenario has 4 turns with carefully tuned eval deltas to hit all 4 phases.

---

## Problems We Faced & How We Fixed Them

### 1. Stub responses were generic / wrong topic
**Problem**: The stub responses talked about LLM outages and microservices regardless of what idea was submitted.  
**Fix**: Created 3 keyed demo scenarios, each matched by keywords from the idea. Each has project-specific questions.

### 2. Phase badge always showed "INTAKE"
**Problem**: Eval delta values were too small — scores never crossed the 0.40 threshold needed to enter the "debate" phase.  
**Fix**: Recalculated all 12 eval_delta blocks (3 scenarios × 4 turns) to hit the right thresholds: intake→debate at 40%, debate→stress_test at 70%, masterplan at 85%.

### 3. PostgreSQL healthcheck failing
**Problem**: `pg_isready -U socra` tries to connect to a database named "socra" (same as user), which doesn't exist.  
**Fix**: Changed to `pg_isready -U socra -d socra_db`.

### 4. Circular import crash
**Problem**: `LandingPage.tsx` imported Clerk components from `App.tsx`, which imports `LandingPage` — circular dependency.  
**Fix**: Created `src/lib/auth.tsx` as a neutral re-export point for Clerk components.

### 5. Vite HMR not working on Windows + Docker
**Problem**: inotify file events don't propagate from the Windows host filesystem into the Linux Docker container, so Vite's file watcher never triggers.  
**Fix**: Added `usePolling: true, interval: 300` to `vite.config.ts`.

### 6. `docker compose restart` not picking up `.env` changes
**Problem**: `restart` reuses existing containers without re-reading env files.  
**Fix**: Must use `docker compose up -d` to recreate containers with updated environment variables.

### 7. Railway backend not redeploying from GitHub
**Problem**: After reconnecting the GitHub repo to the Railway backend service, pushes weren't triggering new deployments — Railway kept running old code.  
**Fix**: Deleted the backend service and created a new one fresh. New service correctly auto-deploys on push.

### 8. CORS blocking all API calls on production
**Problem**: Backend only allowed `localhost:3000` and `localhost:5173`. All requests from the Railway frontend URL were blocked.  
**Fix**: Changed CORS config to use `allow_origin_regex=r"https://.*\.up\.railway\.app|http://localhost:(3000|5173)"` to allow any Railway subdomain.

### 9. Groq API key with trailing newline
**Problem**: When pasting the API key into Railway's Variables tab, an invisible `\n` was appended. This caused `Illegal header value` errors and crashed every LLM call.  
**Fix**: Re-entered the key manually in Railway. Also added `.strip()` in `config.py` as a defensive measure.

### 10. Railway PORT mismatch
**Problem**: Railway injects a dynamic `PORT` env var and routes traffic to it. Our Dockerfile hardcoded port 8000, so Railway's proxy couldn't reach the app.  
**Fix**: Set `PORT=8000` explicitly in Railway's Variables tab so the proxy knows to route to port 8000.

### 11. Frontend production Dockerfile ran dev server
**Problem**: The original `frontend/Dockerfile` used `npm run dev`, which is a development server — not suitable for production.  
**Fix**: Rewrote the Dockerfile to do a multi-stage build: `npm run build` in a builder stage, then serve the `dist/` folder with the `serve` package.

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `GROQ_API_KEY` | backend | LLaMA 3.3 70B via Groq (free) |
| `ANTHROPIC_API_KEY` | backend | Claude Sonnet (optional) |
| `STUB_MODE` | backend | `true` = use demo scenarios, `false` = real LLM |
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `REDIS_URL` | backend | Redis connection string |
| `SECRET_KEY` | backend | JWT signing key |
| `CLERK_SECRET_KEY` | backend | Clerk server-side auth |
| `CLERK_FRONTEND_API_URL` | backend | Clerk JWKS endpoint |
| `VITE_API_URL` | frontend (build) | Backend URL for API calls |
| `VITE_WS_URL` | frontend (build) | Backend URL for WebSocket/SSE |
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend (build) | Clerk public key |

---

## Local Development

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart after .env changes (must use up -d, not restart)
docker compose up -d

# Query the database
docker compose exec postgres psql -U socra -d socra_db -c "SELECT * FROM waitlist;"
docker compose exec postgres psql -U socra -d socra_db -c "SELECT id, phase, total_score FROM sessions;"
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000  
API docs: http://localhost:8000/docs

---

## What's Next

| Priority | Task |
|----------|------|
| High | Update Clerk allowed origins to include production URL |
| High | Share the app and get real user feedback |
| Medium | Real Groq streaming (currently pre-computes then word-by-word — 3-5s blank wait) |
| Low | Custom domain (buy a `.com` or `.in` for ~₹800/year) |
| Low | Admin dashboard to view all sessions and waitlist emails |
