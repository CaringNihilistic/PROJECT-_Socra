# Socra — Scalability Analysis

> Based on a full read of the production architecture: single uvicorn process, Railway Postgres with pool_size=10/max_overflow=20, Groq/Anthropic/Google LLM backends, no Redis in production, no multi-worker setup.

---

## Current Architecture (what's actually running on Railway)

```
Browser
  └── Railway Frontend  (static Vite build — essentially unlimited)
          ↓
  Railway Backend  (1 uvicorn process, 1 async event loop, 1 CPU core)
          ↓
  Railway PostgreSQL  (pool_size=10, max_overflow=20 = 30 total connections)
          ↓
  LLM API  (Anthropic / Google / Groq — external, their rate limits apply)
```

No Redis in production. No multiple workers. No load balancer. One process, one core.

---

## The Key Insight: Async ≠ Single User

A single uvicorn process does **not** mean one user at a time. FastAPI is ASGI + asyncio — every LLM call, DB query, and HTTP request is `await`ed, so the event loop handles hundreds of concurrent connections while they all wait on external IO. Python is not doing any real work during those waits.

What blocks is: DB connections running out, LLM API hitting rate limits, or CPU being hammered. Not the event loop itself.

---

## The Three Real Ceilings

### Ceiling 1 — Database connections (~30 concurrent active streams)

```python
pool_size=10, max_overflow=20  # = 30 total connections max
```

Every active SSE stream (`/message/stream`, `/tribunal/message`) holds an `AsyncSession` open for the full duration — 10 to 90 seconds depending on the LLM path.

- **30 simultaneous active streams = the hard DB ceiling**
- Users browsing, typing, or on the landing page consume zero connections
- After 30, new requests queue for up to `pool_timeout=30s` then fail

### Ceiling 2 — LLM API rate limits (the actual bottleneck)

Each session turn hits your LLM provider. These are external and can't be fixed by scaling Railway.

| Provider | RPM limit | Calls per masterplan | Max simultaneous masterplans |
|----------|-----------|---------------------|------------------------------|
| Groq (free) | 30 RPM | 5–6 calls | ~5 |
| Groq (paid) | 6,000 RPM | 5–6 calls | ~1,000 |
| Google Gemini (free) | ~1 RPM effective | 6 calls | basically 0 |
| Google Gemini (paid) | 1,000 RPM | 6 calls | ~166 |
| Anthropic (tier 1) | 50 RPM | 6 calls | ~8 |
| Anthropic (tier 4) | 4,000 RPM | 6 calls | ~666 |

On Groq free tier: **5 concurrent masterplan generations** is the global ceiling no matter what else you do.

### Ceiling 3 — Railway plan (RAM + CPU)

- **RAM:** 30 active SSE streams × ~100KB conversation history ≈ 3MB. Not an issue.
- **CPU:** Python uses one core per process. At 50+ simultaneous users the event loop starts showing CPU contention on a shared host (Railway Hobby plan).
- **Postgres storage:** Railway Hobby = 1GB. Each session with masterplan ≈ 50–200KB. That's **5,000–20,000 sessions** before you hit the storage ceiling.

---

## Realistic Numbers Right Now

| Scenario | Current capacity |
|----------|-----------------|
| Users browsing / typing (no active stream) | 500+ |
| Simultaneous mid-conversation turns | ~30 (DB pool limit) |
| Simultaneous masterplan generations | ~5–8 (LLM free tier limit) |
| Total sessions before DB storage issues | ~5,000–20,000 |
| Sustainable daily sessions | ~200–300 on Groq free tier |
| **Comfortable daily active users** | **50–100 DAU** |

At **300+ DAU** you start feeling LLM rate limits.
At **1,000+ DAU** you need to upgrade multiple layers.

---

## The Single Biggest Quick Win (Already Being Implemented)

The 5 specialist agents in the masterplan pipeline currently run **sequentially** for Anthropic and Google:

```python
# Before — sequential, ~90 seconds total DB connection held open
for agent_cfg in SPECIALIST_AGENTS:
    report = await run_specialist_agent(agent_cfg, conversation_history)
    yield {"type": "agent_report", "report": report}
```

After parallelization with `asyncio.gather`:

```python
# After — parallel, ~20 seconds total
tasks = [run_specialist_agent(a, conversation_history, web_context) for a in SPECIALIST_AGENTS]
reports = await asyncio.gather(*tasks)
```

**Impact:**
- Masterplan time: 90s → ~20s
- DB connection held open: 90s → 20s per masterplan
- Effective concurrent masterplan capacity: 3× increase, zero infrastructure cost

---

## Scale-Up Roadmap

### Stage 1 — 100–500 DAU
**Trigger:** Masterplan generation starts timing out or users report slow responses.
**Cost:** ~$50–200/month additional (LLM API upgrade)

| Action | What it does |
|--------|-------------|
| Upgrade to Anthropic paid tier or Groq paid | RPM: 50 → 4,000. Removes the LLM ceiling. |
| Parallelize specialist agents (already done) | Masterplan: 90s → 20s. 3× more concurrent capacity. |
| Add `TAVILY_API_KEY` on Railway | Web research works in production, better agent quality. |

No Railway changes needed at this stage.

---

### Stage 2 — 500–2,000 DAU
**Trigger:** CPU usage consistently above 70% on Railway, response latency climbing.
**Cost:** ~$20–50/month additional (Railway Pro plan)

**Switch from uvicorn to gunicorn with multiple workers.**

Change `backend/Dockerfile`:
```dockerfile
# Before
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"

# After
CMD sh -c "gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}"
```

Add `gunicorn` to `requirements.txt`.

4 workers = 4 CPU cores = 4× throughput. Also adjust pool per worker:
```python
pool_size=5, max_overflow=10  # per worker — Railway Pro has enough headroom
```

Upgrade Railway backend to **Pro plan** (dedicated CPU, 8GB RAM).

**Problem this creates:** The in-memory rate limiter (`RateLimitMiddleware`) doesn't coordinate across workers. Each of 4 workers has its own counter — effective rate limit becomes 4× what you configured. Fix at Stage 3.

---

### Stage 3 — 2,000–10,000 DAU
**Trigger:** Rate limiting breaks, DB queries getting slow, storage running out.
**Cost:** ~$50–150/month additional

| Action | What it does |
|--------|-------------|
| Redis-backed rate limiting | Shared counter across all workers. Redis is already in the config, just unused. |
| Upgrade Railway Postgres to Standard plan | More storage, dedicated resources, connection limits lifted. |
| Add DB indexes on `created_at`, `follow_up_sent` | The follow-up email query is currently a full table scan. At 10K+ rows this is slow. |
| Add `created_at` index on sessions | List queries for session history get faster. |

**DB indexes to add (one migration):**
```sql
CREATE INDEX IF NOT EXISTS ix_sessions_created_at ON sessions (created_at);
CREATE INDEX IF NOT EXISTS ix_sessions_follow_up ON sessions (follow_up_sent, created_at)
  WHERE follow_up_email IS NOT NULL;
```

---

### Stage 4 — 10,000+ DAU
**Trigger:** You're making real money. Architect properly.
**Cost:** $200–500+/month

This is full infrastructure work. Not premature — do it when you hit 5,000 DAU, not before.

| Action | What it does |
|--------|-------------|
| Move to Neon / Supabase / RDS | Managed Postgres with autoscaling, read replicas, point-in-time recovery |
| Cloudflare in front of frontend | CDN, DDoS protection, edge caching for static assets |
| Background job queue (arq + Redis) | Decouple masterplan generation from HTTP — Railway restart won't kill in-flight LLM calls |
| Redis session cache | Cache hot session data to avoid DB round-trips on every SSE event |
| Railway autoscaling or fly.io | Horizontal scaling — spin up more backend instances under load |
| Separate LLM worker service | Isolate expensive LLM calls to a dedicated service with its own scaling rules |

---

## What Never Needs to Change (Regardless of Scale)

| Component | Why it scales fine |
|-----------|-------------------|
| Frontend (Vite static build) | Railway CDN serves it. No compute involved. |
| Razorpay billing | External service, scales independently. |
| Clerk auth | External service, scales independently. |
| Resend email | External service, 90-day cron is a single daily batch. |
| Webhook handler | Single fast DB write per payment. No LLM involved. |
| Session ID scheme (UUIDs) | No central counter, no coordination needed at scale. |

---

## Monitoring Checklist (Before You Hit Problems)

Set these up before you need them:

| Metric | Tool | Alert threshold |
|--------|------|----------------|
| Railway backend CPU | Railway metrics dashboard | > 70% sustained |
| Railway Postgres storage | Railway metrics dashboard | > 800MB |
| LLM API error rate | Railway logs (`grep "rate limit"`) | Any spike |
| `/health` DB status | External uptime monitor (Better Uptime, free) | `"db": "error"` |
| 429 rate limit hits | Railway logs | Sustained > 10/hour from same IP |
| Masterplan generation time | Add timing logs to `stream_multi_agent_masterplan` | > 120s |

---

## Cost Projection

| DAU | Monthly infra cost | Notes |
|-----|--------------------|-------|
| 0–100 | ~$10–20 | Current Railway Hobby + Groq free |
| 100–500 | ~$60–120 | + Anthropic paid API |
| 500–2,000 | ~$100–200 | + Railway Pro plan |
| 2,000–10,000 | ~$200–400 | + Managed Postgres + Redis |
| 10,000+ | $500+ | Full infrastructure rebuild |

LLM API cost scales with usage, not users. One masterplan generation costs roughly:
- Anthropic Haiku: ~$0.002–0.005 per masterplan
- Google Gemini Flash: ~$0.001–0.003 per masterplan
- Groq (paid): ~$0.001–0.002 per masterplan

At 1,000 masterplans/month: $2–5 in LLM costs. At 100,000/month: $200–500.

---

## Summary

```
Right now:       50–100 DAU comfortable, 300 DAU starts straining
Quick win:       Parallelize agents → 3× masterplan capacity, zero cost (done)
First upgrade:   LLM API paid tier → unblocks 500+ DAU
Second upgrade:  Gunicorn 4 workers + Railway Pro → 2,000+ DAU
Third upgrade:   Redis rate limiting + Postgres upgrade → 10,000+ DAU
Long term:       Background jobs + autoscaling + managed DB → unlimited
```

The architecture is sound. Nothing needs a rewrite to scale — it's purely additive upgrades, in the right order, triggered by actual load rather than speculation.
