"""
LLM Client — wraps Anthropic API with a stub mode for local dev.
STUB_MODE=true activates demo scenarios keyed to the 3 landing page examples.
For any other idea, stub mode returns a prompt to set ANTHROPIC_API_KEY.
"""
import asyncio
import json
import random
from typing import Optional
from core.config import settings


# ---------------------------------------------------------------------------
# Demo scenario data — only used when STUB_MODE=true
# ---------------------------------------------------------------------------

_DEMO_SCENARIOS = {
    "api_docs": {
        "keywords": ["api", "documentation", "annotate", "swagger", "openapi", "readme"],
        "responses": [
            {
                "message": "Before I architect anything I need to understand who you're building for — and what's actually broken.\n\n**1. Who is the primary user — the API *producer* or the API *consumer*?**\nA tool that helps developers write better docs is a different product from one that helps consumers navigate them. Different builds, different GTM.\n\n**2. What's broken today specifically?**\nConfluence, Readme.com, Notion, Swagger UI — all used for API docs. What's the workflow that's painful enough that a team would switch and pay?\n\n**3. What does 'collaborative' mean in your context?**\nAsync comments (like Google Docs)? Real-time co-editing? Review/approval workflows before publishing? Each has very different technical requirements and user behavior.",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.15, "tech_context": 0.0, "success_definition": 0.15, "risk_awareness": 0.05},
                "new_assumptions": ["Target users are software developers", "Collaboration is the differentiator vs static doc tools"],
                "phase": "intake",
                "choices": ["API producers — devs who write & own the docs", "Both sides — unified platform for writers and readers", "Internal platform teams managing 10+ APIs", "DevEx teams where docs get stale within weeks"],
            },
            {
                "message": "Good context. Now I want to stress one assumption you might be making.\n\n'Developers want to collaborate on docs' is not the same as 'developers will actually *do* it.' Documentation is famously the thing every team knows they should do but doesn't. The question isn't *can* they collaborate — it's **what forces them to?**\n\n**1. What's the forcing function?**\nCI/CD gate (PR can't merge until docs are updated)? A Slack notification to the doc owner? A product manager who owns doc quality? Without a forcing function, collaboration tools become ghost towns.\n\n**2. Who is *paying* for this — the developer who writes docs, or the team lead who wants docs to exist?**\nThese are different buyers. Team leads have budget and leverage; developers don't. If it's the team lead, you need an enterprise sales motion from day one. If it's individual devs, you need product-led growth. The architecture and pricing implications are completely different.",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.35, "tech_context": 0.25, "success_definition": 0.35, "risk_awareness": 0.20},
                "new_assumptions": ["Buyer and user may be different people", "Forcing function is the key retention mechanism"],
                "phase": "intake",
                "choices": ["Engineering managers — they own doc quality and have budget", "Individual developers — product-led, bottom-up growth", "CI/CD gate forces it — PR blocked until docs are updated", "Both buyers — devs use it, managers pay for the team plan"],
            },
            {
                "message": "Let me propose a stack — and immediately argue against part of it.\n\n**Proposal:** React SPA, FastAPI backend, PostgreSQL, WebSockets for real-time collaboration (Yjs for CRDT), Railway for hosting.\n\n**Why real-time is probably wrong at your stage:**\nYjs and operational transforms are genuinely hard to implement correctly. You'll spend 3 weeks on conflict resolution edge cases before you write a single line of business logic. GitHub's collaborative editing took a 5-person team 6 months.\n\n**Counter-proposal:** Ship async collaboration first — threaded comments, diff views, approval workflows. Google Docs launched with basic commenting long before real-time. If users aren't asking for simultaneous editing after 3 months of usage, you saved yourself enormous complexity.\n\n**The question that changes everything:** Do your target users need to edit the same doc *at the same time*, or do they need to *review and comment* on each other's work asynchronously? Most API doc workflows are the latter.",
                "eval_delta": {"problem_clarity": 0.20, "scale_constraints": 0.25, "tech_context": 0.40, "success_definition": 0.25, "risk_awareness": 0.25},
                "new_assumptions": ["Async collaboration is sufficient for v1", "Real-time editing is a Phase 2 feature"],
                "phase": "debate",
                "choices": ["Async review — comments and approval workflows are enough", "Real-time co-editing is the core differentiator we're building", "Review/approval states: draft → review → published", "Async first, add real-time only if users demand it"],
            },
            {
                "message": "Three failure modes I want you to think through before we finalize:\n\n**Scenario 1 — An engineer pastes an internal API key into a doc example:**\nSomeone adds a code snippet with a live staging credential. Another user copies it. How are you detecting and redacting secrets in doc content? This is a liability problem, not just a UX problem — you need secret scanning before launch.\n\n**Scenario 2 — Your first enterprise prospect asks for SSO on the first sales call:**\nEvery company over 100 employees will require Okta/Google Workspace SSO before they sign. Bolting SAML/OIDC onto an existing auth system is painful. Are you designing your auth layer *now* to support it later without a rewrite?\n\n**Scenario 3 — A customer has 500 API endpoints:**\nYour UI is probably designed around 10–20 docs. At 500, search and navigation *become* the product. How are you handling large-scale organization — namespaces, versioning, full-text search indexing?",
                "eval_delta": {"problem_clarity": 0.05, "scale_constraints": 0.15, "tech_context": 0.10, "success_definition": 0.10, "risk_awareness": 0.25},
                "new_assumptions": ["Secret scanning is a compliance requirement", "Enterprise SSO is a day-1 sales requirement"],
                "phase": "stress_test",
                "choices": ["SSO via Clerk from day 1 — it's already in the plan", "SMB only to start — skip enterprise complexity for now", "Enterprise from day 1, SSO is non-negotiable for our market", "Add SSO only when we land our first enterprise deal"],
            },
        ],
        "masterplan": """# Masterplan: Collaborative API Documentation Platform

## Project Summary
A collaboration layer for API documentation — threaded review, approval workflows, and version-controlled docs — targeting teams where documentation is currently a shared Google Doc or a neglected Confluence page.

---

## Recommended Architecture

### Core Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React + TypeScript + Tiptap editor | Tiptap gives you a production-ready rich-text editor with comment extensions out of the box |
| Backend | FastAPI (Python) | Async-native, fast to prototype, easy WebSocket upgrade path for real-time in Phase 2 |
| Database | PostgreSQL | JSONB columns handle doc content without schema thrashing; row-level security for org isolation |
| Auth | Clerk or Auth0 | Pre-built SSO/SAML support so you don't rewrite auth when the first enterprise deal comes in |
| Hosting | Railway (MVP) → AWS (scale) | Railway for fast iteration; migrate when you have >5 paying teams |

### What to skip in v1
- Real-time co-editing (Yjs/CRDT) — async comments cover 90% of team workflows
- Custom search indexing — Postgres full-text search handles 50K docs comfortably

---

## Implementation Phases

### Phase 1 — Core Editor + Async Review (Weeks 1–4)
- [ ] Rich-text doc editor (Tiptap) with API endpoint schema blocks
- [ ] Threaded inline comments with @mentions
- [ ] Doc versioning (store diffs, not full snapshots)
- [ ] Invite-based team workspaces

### Phase 2 — Workflow + Integrations (Weeks 5–8)
- [ ] Approval workflow (draft → review → published states)
- [ ] CI/CD webhook: POST to mark a doc as stale when a PR merges
- [ ] GitHub/GitLab integration: sync OpenAPI spec changes to docs
- [ ] SSO via Clerk (Okta, Google Workspace)

### Phase 3 — Scale + Enterprise (Weeks 9–12)
- [ ] Secret scanning on doc content (regex + ML-based)
- [ ] Namespaces and doc hierarchy for 100+ endpoint orgs
- [ ] Audit log (who changed what, when)
- [ ] Public/private doc portal with custom domain

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No forcing function → ghost town | High | Critical | Build the CI/CD integration first; it makes the tool mandatory |
| Enterprise SSO demand on first call | High | High | Use Clerk from day one — SSO is a config, not a rewrite |
| Secret leakage in doc content | Medium | Critical | Add regex-based secret scanning before any public launch |
| Real-time expectation from users | Medium | Medium | Set expectations: "async-first, real-time in roadmap" |

---

## First 3 Files to Write

1. `backend/api/routes/documents.py` — CRUD + versioning for docs
2. `frontend/src/components/Editor/Editor.tsx` — Tiptap instance with comment extension
3. `backend/core/secret_scanner.py` — Regex patterns for common credential formats
""",
    },

    "ml_marketplace": {
        "keywords": ["ml", "machine learning", "data label", "freelance", "bid", "contractor", "engineer"],
        "responses": [
            {
                "message": "Two-sided marketplaces are one of the hardest products to build at zero. Before I touch architecture, I need to understand your supply-and-demand strategy.\n\n**1. Which side do you acquire first — ML engineers, or companies with labeling work?**\nIf you launch with engineers but no jobs, they churn immediately. If you launch with companies but no engineers, you can't fulfill. What's your concrete day-one plan for the side you're *not* focused on?\n\n**2. What's your take rate, and who pays it?**\nUpwork takes 10–20% from the freelancer. Toptal charges the client. The direction changes your incentive structure and pricing ceiling. Have you modeled unit economics at your expected take rate?\n\n**3. What makes this specific to ML engineers — not just Upwork with a filter?**\nData labeling contracts are already posted on every freelance platform. What's the specialized value — verified ML credentials? Domain-specific project templates? Handling 1099s and international payments automatically?",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.15, "tech_context": 0.0, "success_definition": 0.15, "risk_awareness": 0.05},
                "new_assumptions": ["Two-sided marketplace model", "Target users are ML engineers and companies needing labeled data"],
                "phase": "intake",
                "choices": ["ML engineers first — 20 vetted profiles before any launch", "Companies first — validate demand with 5 pilot clients", "Both simultaneously through targeted LinkedIn outreach", "Concierge matching — do it manually until the pattern is clear"],
            },
            {
                "message": "One thing you haven't addressed that will define your entire business model: **off-platform leakage**.\n\nAfter an engineer and a company connect through your platform, what stops them from doing the next contract over email? This is the core existential risk of every marketplace — and 'we'll ban them' doesn't work at scale.\n\n**1. What's the ongoing value of staying on-platform?**\nUpwork uses escrow + payment protection. Toptal uses ongoing quality screening. Airbnb uses reviews + insurance. What's *your* reason for repeat users to stay?\n\n**2. Short-term contracts specifically hurt you.**\nA 2-week labeling job has very low switching costs. Engineer gets paid, company gets data, they never return. Are you designing for repeat business, or purely transaction volume? The architecture — especially the matching and notification systems — is completely different for each.\n\n**3. Compliance is a hidden cost you need to price in now.**\nML contractors working cross-border means currency conversion, 1099-NEC forms (over $600/year), IR35 in the UK. Are you handling payments via Stripe Connect / Deel, or rolling your own?",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.35, "tech_context": 0.25, "success_definition": 0.35, "risk_awareness": 0.20},
                "new_assumptions": ["Off-platform leakage is the primary retention risk", "Compliance handling is a core product feature"],
                "phase": "intake",
                "choices": ["Escrow + payment protection makes on-platform safer", "Verified badges and quality screening create stickiness", "Long-term retainers — structure contracts to span months", "Reviews and reputation make it risky to go off-platform"],
            },
            {
                "message": "Here's the architecture I'd propose — followed by why you should think twice before building it.\n\n**Proposal:** React frontend, Django backend (more batteries than FastAPI for marketplace features), PostgreSQL, Stripe Connect for split payments, Algolia for engineer search, Railway for MVP.\n\n**Why I'd argue against a generic marketplace approach:**\nThe differentiation in your pitch isn't the marketplace mechanics — Upwork already does those. It's the ML-specific filtering and vetting. 'Machine learning' on someone's Upwork profile is not the same as someone who has shipped production data labeling pipelines.\n\nIf your moat is quality, then the *assessment and credentialing system* is your core product. That means your first 3 months of engineering should be on skill verification, not job boards.\n\n**Counter-proposal:** Start with a curated, invite-only roster of 20–30 vetted engineers. No marketplace UX. Companies fill a form, you match manually. This validates demand before you build supply-side infrastructure.\n\nDoes manual matching feel like a step backward, or is that something you could execute in month 1?",
                "eval_delta": {"problem_clarity": 0.20, "scale_constraints": 0.25, "tech_context": 0.40, "success_definition": 0.25, "risk_awareness": 0.25},
                "new_assumptions": ["MVP can start as manual concierge matching", "Credentialing is the moat, not marketplace UX"],
                "phase": "debate",
                "choices": ["Concierge first — 10 manual matches before building any marketplace UI", "Full marketplace from day one — self-serve is the product", "Hybrid — marketplace UI but I match manually behind the scenes", "Invite-only roster, companies apply to access engineers"],
            },
            {
                "message": "Three things that will break this if you don't address them now:\n\n**Scenario 1 — Credential fraud:**\nSomeone claims to be a senior ML engineer from a credible company. You place them. They deliver unusable labeled data. The company disputes payment and leaves. How are you verifying credentials upfront? What's your dispute resolution and chargeback policy?\n\n**Scenario 2 — Your first big client wants a custom SLA:**\nA funded startup says they'll bring 10 projects/month if you guarantee 48-hour matching, a dedicated account manager, and custom invoicing. Do you build for them and become a staffing agency, or hold the line on your self-serve model? This decision has a major impact on your engineering roadmap — custom enterprise tooling is a product in itself.\n\n**Scenario 3 — 1099 season:**\nYou have 50 contractors who each earned over $600 through your platform this year. You're legally required to issue 1099-NEC forms by January 31st. Does your payment infrastructure handle this automatically, or are you doing it manually at midnight in January?",
                "eval_delta": {"problem_clarity": 0.05, "scale_constraints": 0.15, "tech_context": 0.10, "success_definition": 0.10, "risk_awareness": 0.25},
                "new_assumptions": ["Fraud prevention is a launch requirement", "1099 compliance must be automated, not manual"],
                "phase": "stress_test",
                "choices": ["Stripe Connect — handles payouts and 1099-NEC automatically", "Deel for international contractors from the start", "Manual payments in Phase 1, automate once we hit 20 contractors", "Partner with a payroll provider before the first payment goes out"],
            },
        ],
        "masterplan": """# Masterplan: ML Engineer Marketplace

## Project Summary
A curated marketplace connecting vetted ML engineers with companies that need short-term data labeling and annotation work — differentiated by credential verification and compliance handling, not just job-board mechanics.

---

## Recommended Architecture

### Core Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React + TypeScript | Standard SPA; no SSR needed at MVP |
| Backend | Django + DRF | Built-in admin, auth, ORM — faster to build marketplace features than FastAPI |
| Database | PostgreSQL | Transaction integrity for payments; JSONB for flexible engineer profiles |
| Payments | Stripe Connect (Express) | Handles split payments, 1099s, international payouts — don't build this yourself |
| Search | Postgres full-text → Algolia (Phase 2) | Full-text search covers MVP; Algolia when faceted filtering matters |
| Hosting | Railway → AWS ECS | Railway for speed; migrate when you have >20 concurrent projects |

### Phase 0 (pre-code): Manual concierge
Run matching manually for the first 10 projects. Learn what filters matter before you build them.

---

## Implementation Phases

### Phase 1 — Curated Roster MVP (Weeks 1–4)
- [ ] Engineer profiles with skill tags, portfolio links, rate range
- [ ] Company project intake form (scope, timeline, budget, data type)
- [ ] Admin matching dashboard (internal — not automated yet)
- [ ] Stripe Connect onboarding for engineer payouts
- [ ] Basic review system (company reviews engineer after project)

### Phase 2 — Self-Serve Marketplace (Weeks 5–8)
- [ ] Public job board with engineer search and filtering
- [ ] Bidding system (engineers propose rates on posted projects)
- [ ] Escrow: funds held until company approves deliverable
- [ ] Dispute resolution workflow
- [ ] Automated 1099-NEC generation via Stripe Tax

### Phase 3 — Credentialing + Retention (Weeks 9–12)
- [ ] Skill assessment tests (domain-specific, time-boxed)
- [ ] Verified badge system (passed assessment + background check)
- [ ] Repeat-project incentives (preferred rates for long-term relationships)
- [ ] Enterprise tier: dedicated account manager, SLA, custom invoicing

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Off-platform leakage | High | Critical | Escrow + payment protection makes on-platform safer than off |
| Credential fraud | High | High | Manual vetting for Phase 1; automated assessments in Phase 3 |
| 1099 compliance failure | Medium | High | Stripe Tax automates this — non-negotiable dependency |
| Enterprise SLA demands | Medium | Medium | Build enterprise tier explicitly in Phase 3, not as one-offs |

---

## First 3 Files to Write

1. `backend/engineers/models.py` — Engineer profile with skills, rate, availability
2. `backend/projects/models.py` — Project scope, timeline, status, assigned engineer
3. `backend/payments/stripe_connect.py` — Engineer onboarding + payout logic
""",
    },

    "grocery": {
        "keywords": ["grocery", "receipt", "price", "food", "store", "supermarket", "scan"],
        "responses": [
            {
                "message": "Receipt scanning is a solved technical problem — Google ML Kit gets you 90% accuracy out of the box. So I'm less interested in *how* you scan and more interested in *what problem you're actually solving*.\n\n**1. What's the core job-to-be-done?**\nThere are at least four different apps hiding in 'track grocery prices across stores': (a) find the cheapest store for my regular shopping list, (b) alert me when something I buy goes on sale, (c) track my total grocery spending over time, (d) help me meal-plan within a budget. These have different user behaviors, different retention loops, and different architectures.\n\n**2. Where does your price data come from?**\n'Local stores' is the hard part. Grocery prices aren't available via public API, vary by location, and change multiple times per week. Are you crowdsourcing from user receipts, scraping store websites, or partnering directly with chains? Each has completely different data quality and legal risk.\n\n**3. Who specifically is this for?**\nBudget-conscious families optimizing a $300/week shop behave differently from students on $50/week. The first group has more to save; the second will actually open an app 3× a day.",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.15, "tech_context": 0.0, "success_definition": 0.15, "risk_awareness": 0.05},
                "new_assumptions": ["OCR/receipt scanning is the primary data input", "Price comparison across stores is the core value prop"],
                "phase": "intake",
                "choices": ["Find cheapest store for my regular weekly shopping list", "Alert me when items I track regularly go on sale", "Track my total grocery spending and categories over time", "Help plan meals within a fixed weekly budget"],
            },
            {
                "message": "I want to push on the data strategy — because it's the make-or-break for this product.\n\n**Crowdsourcing from receipts has a brutal cold-start problem.**\nIf you have 50 users across 5 stores, the data is stale, incomplete, and wrong. Users churn before you hit the density needed for the data to be useful. Unlike social networks, where empty data is just boring, empty price data is *actively misleading* — a user drives to the wrong store.\n\n**1. What do you show users before you have enough crowdsourced data?**\nOne strategy: launch in one city, partner with one grocery chain to get real price data upfront, and use receipts to *verify and update* rather than to *originate* the dataset.\n\n**2. Have you looked at the legal position?**\nReceipts contain PII (last 4 of card, sometimes the cardholder name). Uploading photos to a server requires a clear privacy policy and data retention policy. GDPR applies if you have EU users. This isn't hard to solve, but you need a lawyer to sign off before launch.\n\n**3. What's the monetization model?**\nIf it's free, how do you sustain it? Grocery price data has real B2B value to CPG brands and retailers. Is there a data licensing play here, or is this purely a consumer subscription?",
                "eval_delta": {"problem_clarity": 0.30, "scale_constraints": 0.35, "tech_context": 0.25, "success_definition": 0.35, "risk_awareness": 0.20},
                "new_assumptions": ["Cold-start problem requires a non-crowdsourced data seed", "Privacy/GDPR compliance is a launch requirement"],
                "phase": "intake",
                "choices": ["Manually seed one grocery chain's prices, receipts verify and update", "Partner directly with chains for official price feeds", "Crowdsource from day one — cold start is a growth problem", "Consumer subscription — $2.99/month for unlimited price alerts"],
            },
            {
                "message": "Stack proposal — and the challenge.\n\n**Proposal:** React Native (Expo), FastAPI backend, PostgreSQL for price history, S3 for receipt images, Google ML Kit for OCR, Railway for hosting.\n\n**Why React Native might be the wrong call for v1:**\nReceipt scanning needs a fast, reliable camera UX — accurate cropping, immediate feedback, clear error states. React Native camera libraries have historically been unreliable for production OCR workflows, and the native iOS camera experience is hard to replicate well.\n\n**Counter-proposal:** iOS only, with Expo's managed Camera API as a middle ground. Target iPhone users in *one city* with *one grocery chain*. Manually seed that chain's prices. Prove that users will actually scan receipts 3+ times per week before building Android or a multi-chain pipeline.\n\n**The question that changes your entire architecture:**\nAre you building a *data business* (price intelligence that happens to have a consumer app) or a *consumer app* (personal finance tool that collects price data as a side effect)?\n\nData business → your moat is the dataset; spend engineering on ingestion pipeline and data quality.\nConsumer app → your moat is UX; spend engineering on notifications, lists, and meal planning.\nThese are different products.",
                "eval_delta": {"problem_clarity": 0.20, "scale_constraints": 0.25, "tech_context": 0.40, "success_definition": 0.25, "risk_awareness": 0.25},
                "new_assumptions": ["iOS-only MVP in one city is the right starting scope", "Consumer app vs data business distinction must be decided"],
                "phase": "debate",
                "choices": ["Consumer app — UX and notifications are the product, data is a side effect", "Data business — price intelligence is the real moat", "iOS only in one city with one manually-seeded chain to start", "Both platforms from day one — React Native removes the tradeoff"],
            },
            {
                "message": "Three scenarios that will define whether this survives past month 3:\n\n**Scenario 1 — Your data is wrong and a user drives to the wrong store:**\nSomeone checks the app, drives 15 minutes expecting eggs at $3.99, finds them at $5.49 because prices changed yesterday. They leave a 1-star review and tell 5 friends. How are you surfacing data freshness — 'last verified 3 hours ago' vs 'crowdsourced 12 days ago'? The UI needs to communicate confidence, not just a number.\n\n**Scenario 2 — A grocery chain sends you a cease-and-desist:**\nKroger doesn't want you systematically collecting their pricing data. Their ToS likely prohibits it. This isn't hypothetical — LinkedIn sued hiQ, Ticketmaster sued scrapers, and supermarket chains are increasingly litigious about pricing data. What's your legal position if your data source is web scraping?\n\n**Scenario 3 — You hit 10,000 users but only in one city:**\nYour data density is high in Austin but useless in Chicago. A new user opens the app and sees nothing. How do you handle geographic expansion — manual seeding, referral campaigns, or accepting that the product is broken outside your launch city until organic growth fills it?",
                "eval_delta": {"problem_clarity": 0.05, "scale_constraints": 0.15, "tech_context": 0.10, "success_definition": 0.10, "risk_awareness": 0.25},
                "new_assumptions": ["Data freshness UI is a critical trust signal", "Legal risk from scraping must be assessed before launch"],
                "phase": "stress_test",
                "choices": ["Show freshness timestamps on every price — 'verified 3 hours ago'", "Only display prices updated within the last 24 hours", "Confidence score based on number of user scans confirming it", "Color-coded freshness badge — green fresh, yellow aging, red stale"],
            },
        ],
        "masterplan": """# Masterplan: Grocery Price Tracker

## Project Summary
A mobile app that uses receipt scanning to crowdsource grocery prices across local stores, letting users find the cheapest store for their regular shopping list. Launching iOS-only in one city with one manually-seeded grocery chain before expanding.

---

## Recommended Architecture

### Core Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Mobile | React Native (Expo) | Cross-platform path when you're ready; Expo Camera is good enough for receipt scanning |
| OCR | Google ML Kit (on-device) | Free, fast, private — processes receipts without sending images to a server |
| Backend | FastAPI + Python | Async-native; Python has strong data processing libraries for price normalization |
| Database | PostgreSQL | Time-series price history with PostGIS extension for location queries |
| Storage | S3 (receipt images, 90-day retention) | Keep receipts for dispute resolution; auto-delete after 90 days for privacy |
| Hosting | Railway → AWS (when you hit multi-region) | |

### What to skip in v1
- Android (ship iOS first, prove retention)
- Web scraping (legal risk; manually seed one chain's prices)
- Price alerts push notifications (prove daily active use first)

---

## Implementation Phases

### Phase 1 — Receipt Scan + Price History (Weeks 1–4)
- [ ] Camera flow: capture → crop → OCR → parse line items + prices
- [ ] Manual price database for 1 grocery chain in 1 city (seed data)
- [ ] Store price comparison view: "This item at Store A vs Store B"
- [ ] Data freshness timestamps on every price shown
- [ ] Privacy policy + GDPR-compliant receipt handling

### Phase 2 — Lists + Crowdsourcing (Weeks 5–8)
- [ ] Shopping list builder: add items, see cheapest store for whole list
- [ ] Receipt upload contributes prices to shared database (with user consent)
- [ ] Price confidence score (1 scan vs 50 scans)
- [ ] "Report incorrect price" flow

### Phase 3 — Notifications + Monetization (Weeks 9–12)
- [ ] Sale alerts: push notification when tracked items drop in price
- [ ] Spending analytics: weekly/monthly grocery spend by category
- [ ] Android support
- [ ] Monetization: Pro tier ($2.99/month) for unlimited alerts + spending history

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cold-start: no data in new cities | High | Critical | Manually seed 1 chain before launch; expand only when density is proven |
| Legal risk from price scraping | High | High | Do NOT scrape; use receipts + manual partnerships only |
| Data staleness erodes trust | High | High | Show freshness timestamp on every price; never show data >7 days old without warning |
| User scans once, never returns | Medium | Critical | Scan → instant savings shown → share to social is the retention loop to A/B test |

---

## First 3 Files to Write

1. `mobile/src/screens/ScanScreen.tsx` — Camera capture + ML Kit OCR flow
2. `backend/api/routes/prices.py` — Price submission + retrieval with freshness metadata
3. `backend/core/receipt_parser.py` — Normalize OCR text into structured line items
""",
    },
}

_NO_API_KEY_RESPONSE = {
    "message": "**No ANTHROPIC_API_KEY configured.**\n\nSocra needs an Anthropic API key to give you real, idea-specific architecture advice.\n\nAdd your key to `.env`:\n\n```\nANTHROPIC_API_KEY=sk-ant-...\nSTUB_MODE=false\n```\n\nThen restart the backend: `docker compose restart backend`\n\nAlternatively, try one of the 3 example ideas on the home screen — those work in demo mode without a key.",
    "eval_delta": {"problem_clarity": 0.0, "scale_constraints": 0.0, "tech_context": 0.0, "success_definition": 0.0, "risk_awareness": 0.0},
    "new_assumptions": [],
    "phase": "intake",
    "choices": [],
}


def _detect_scenario(conversation_history: list[dict]) -> Optional[str]:
    if not conversation_history:
        return None
    idea = conversation_history[0]["content"].lower()
    for key, scenario in _DEMO_SCENARIOS.items():
        if any(kw in idea for kw in scenario["keywords"]):
            return key
    return None


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

async def _call_groq(system: str, messages: list[dict], max_tokens: int, json_mode: bool = False) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
    kwargs: dict = {
        "model": "llama-3.1-8b-instant",
        "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


async def _call_anthropic(system: str, messages: list[dict], max_tokens: int) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def _call_real_llm(system: str, messages: list[dict], max_tokens: int, json_mode: bool = False) -> str:
    """Route to Anthropic if key is set, otherwise Groq."""
    if settings.anthropic_api_key:
        return await _call_anthropic(system, messages, max_tokens)
    return await _call_groq(system, messages, max_tokens, json_mode=json_mode)


# ---------------------------------------------------------------------------
# Streaming LLM support
# ---------------------------------------------------------------------------

SEPARATOR = "###JSON###"


def _build_groq_conversation_prompt(current_scores: dict) -> str:
    total = sum(current_scores.values()) / 5
    return f"""You are Socra — an expert AI architect who refuses to generate solutions until you fully understand the problem.

Your job is to interrogate, debate, and stress-test project ideas through Socratic dialogue.

CURRENT EVALUATION SCORES (0.0 to 1.0):
- Problem Clarity: {current_scores['problem_clarity']}
- Scale & Constraints: {current_scores['scale_constraints']}
- Tech Context: {current_scores['tech_context']}
- Success Definition: {current_scores['success_definition']}
- Risk Awareness: {current_scores['risk_awareness']}

TOTAL SCORE: {total:.0%}

RULES:
1. Ask maximum 2-3 targeted questions per turn. Never more.
2. If score < 0.4: Stay in intake phase, ask clarifying questions.
3. If score 0.4-0.7: Enter debate phase — propose approaches and argue against them.
4. If score 0.7-0.85: Enter stress-test phase — challenge with failure scenarios.
5. If score > 0.85: Write ONE SHORT SENTENCE confirming analysis is ready (e.g. "Context is sufficient — activating specialist analysis."). Do NOT write the masterplan yourself.

Respond in markdown. Do NOT include any JSON, separators, or structured data in your response — only your conversational reply."""


def _build_groq_eval_prompt(current_scores: dict) -> str:
    return f"""You evaluate structured metadata from a Socratic startup conversation.

CURRENT SCORES (0.0 to 1.0):
- problem_clarity: {current_scores['problem_clarity']}
- scale_constraints: {current_scores['scale_constraints']}
- tech_context: {current_scores['tech_context']}
- success_definition: {current_scores['success_definition']}
- risk_awareness: {current_scores['risk_awareness']}

The conversation ends with an assistant message containing questions for the user. Output a JSON object with exactly these three keys:
- "eval_delta": object — conservative score increments (0.05-0.15 each) ONLY for dimensions the user's latest message actually addressed. Leave others at 0.
- "new_assumptions": array of strings — concrete facts you can infer from the user's latest message (e.g. "Target users are enterprise teams", "No technical co-founder yet").
- "choices": array of exactly 3-4 short strings (max 10 words each) — the most concrete, specific answer options a user would click in response to the assistant's questions. These must be actionable choices, not generic phrases.

Output only valid JSON with these three keys. No extra text."""


def _build_streaming_system_prompt(current_scores: dict) -> str:
    total = sum(current_scores.values()) / 5
    return f"""You are Socra — an expert AI architect who refuses to generate solutions until you fully understand the problem.

Your job is to interrogate, debate, and stress-test project ideas through Socratic dialogue.

CURRENT EVALUATION SCORES (0.0 to 1.0):
- Problem Clarity: {current_scores['problem_clarity']}
- Scale & Constraints: {current_scores['scale_constraints']}
- Tech Context: {current_scores['tech_context']}
- Success Definition: {current_scores['success_definition']}
- Risk Awareness: {current_scores['risk_awareness']}

TOTAL SCORE: {total:.0%}

RULES:
1. Ask maximum 2-3 targeted questions per turn. Never more.
2. If score < 0.4: Stay in intake phase, ask clarifying questions.
3. If score 0.4-0.7: Enter debate phase — propose approaches and argue against them.
4. If score 0.7-0.85: Enter stress-test phase — challenge with failure scenarios.
5. If score > 0.85: Write a single brief sentence confirming analysis is ready (e.g. "Context is sufficient — activating specialist analysis."). Do NOT write the masterplan yourself. Specialist agents will handle it.

OUTPUT FORMAT — write exactly two parts separated by {SEPARATOR}:

[Part 1 — your conversational response in markdown — goes before {SEPARATOR}]
{SEPARATOR}
{{"eval_delta": {{"problem_clarity": 0.0, "scale_constraints": 0.0, "tech_context": 0.0, "success_definition": 0.0, "risk_awareness": 0.0}}, "new_assumptions": [], "phase": "intake", "choices": []}}

JSON rules:
- eval_delta: small positive increments (0.05-0.25) per dimension based on what this turn clarified.
- phase: "intake" | "debate" | "stress_test" | "masterplan"
- choices: 3-4 concise options (max 12 words each) as the most archetypal user responses to your questions. Empty [] for masterplan phase.
- If phase is "masterplan", Part 1 must be ONE SHORT SENTENCE only. The specialist agents generate the actual plan."""


async def _stream_llm_tokens(system: str, messages: list[dict]):
    """Async generator yielding raw text tokens from the configured LLM."""
    if settings.anthropic_api_key:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2500,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
        stream = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=2500,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


async def stream_architect_llm(
    conversation_history: list[dict],
    current_scores: dict,
    turn_number: int,
):
    """
    Async generator yielding:
      {"type": "token", "delta": str}   — message tokens to stream to user
      {"type": "result", "data": dict}  — final structured LLM response
    """
    _default_result = {
        "eval_delta": {k: 0.05 for k in current_scores},
        "new_assumptions": [],
        "phase": "intake",
        "choices": [],
    }

    if settings.is_stub:
        await asyncio.sleep(random.uniform(0.3, 0.7))
        scenario_key = _detect_scenario(conversation_history)
        if scenario_key is None:
            response = _NO_API_KEY_RESPONSE
        else:
            responses = _DEMO_SCENARIOS[scenario_key]["responses"]
            if turn_number < len(responses):
                response = responses[turn_number]
            else:
                response = {
                    "message": "I have enough context now. Generating your masterplan...",
                    "eval_delta": {k: max(0.0, 0.9 - current_scores.get(k, 0.0)) for k in current_scores},
                    "new_assumptions": [],
                    "phase": "masterplan",
                    "choices": [],
                }
        words = response["message"].split(" ")
        for i, word in enumerate(words):
            yield {"type": "token", "delta": word + (" " if i < len(words) - 1 else "")}
            await asyncio.sleep(0.04)
        yield {"type": "result", "data": response}
        return

    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]

    if settings.anthropic_api_key:
        # Anthropic: stream text + embedded ###JSON### separator (reliable)
        system_prompt = _build_streaming_system_prompt(current_scores)
        full_text = ""
        yielded_chars = 0
        message_complete = False

        try:
            async for token in _stream_llm_tokens(system_prompt, msgs):
                full_text += token
                if not message_complete:
                    sep_idx = full_text.find(SEPARATOR)
                    if sep_idx >= 0:
                        message_complete = True
                        remaining = full_text[yielded_chars:sep_idx]
                        if remaining:
                            yield {"type": "token", "delta": remaining}
                    else:
                        safe_end = max(yielded_chars, len(full_text) - len(SEPARATOR) + 1)
                        if safe_end > yielded_chars:
                            yield {"type": "token", "delta": full_text[yielded_chars:safe_end]}
                            yielded_chars = safe_end
        except Exception:
            pass

        if not message_complete:
            remaining = full_text[yielded_chars:]
            if remaining:
                yield {"type": "token", "delta": remaining}
            try:
                result = json.loads(full_text)
            except json.JSONDecodeError:
                result = _default_result
        else:
            json_str = full_text.split(SEPARATOR, 1)[1].strip()
            try:
                result = json.loads(json_str)
            except json.JSONDecodeError:
                import re as _re
                m = _re.search(r'\{.*\}', json_str, _re.DOTALL)
                result = json.loads(m.group()) if m else _default_result

        yield {"type": "result", "data": result}

    else:
        # Groq llama-3.1-8b-instant: two-call approach
        # Call 1: stream plain text (no separator/JSON format required)
        conversation_prompt = _build_groq_conversation_prompt(current_scores)
        message_text = ""
        try:
            async for token in _stream_llm_tokens(conversation_prompt, msgs):
                message_text += token
                yield {"type": "token", "delta": token}
        except Exception:
            pass

        # Call 2: separate JSON-mode call to get structured eval
        eval_prompt = _build_groq_eval_prompt(current_scores)
        eval_msgs = msgs + [{"role": "assistant", "content": message_text}]
        try:
            eval_raw = await _call_groq(eval_prompt, eval_msgs, max_tokens=600, json_mode=True)
            import logging as _logging
            _logging.getLogger(__name__).info("Groq eval result: %s", eval_raw)
            result = json.loads(eval_raw)
            result.setdefault("eval_delta", {k: 0.05 for k in current_scores})
            result.setdefault("new_assumptions", [])
            result.setdefault("phase", "intake")
            result.setdefault("choices", [])
            # Ensure choices is a list, not None
            if not isinstance(result.get("choices"), list):
                result["choices"] = []
        except Exception as e:
            _logging.getLogger(__name__).error("Groq eval failed: %s", e)
            result = _default_result

        yield {"type": "result", "data": result}


# ---------------------------------------------------------------------------
# Public LLM functions
# ---------------------------------------------------------------------------

async def call_llm(
    system_prompt: str,
    messages: list[dict],
    response_format: str = "text",
    stub_response: Optional[dict] = None,
) -> str:
    if settings.is_stub:
        await asyncio.sleep(random.uniform(0.8, 1.5))
        if stub_response:
            return json.dumps(stub_response) if response_format == "json" else str(stub_response)
        return "Stub mode active. Set an API key and STUB_MODE=false to use the real LLM."

    formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
    return await _call_real_llm(system_prompt, formatted, max_tokens=2000)


async def call_architect_llm(
    conversation_history: list[dict],
    current_scores: dict,
    turn_number: int,
) -> dict:
    if settings.is_stub:
        await asyncio.sleep(random.uniform(1.0, 2.0))
        scenario_key = _detect_scenario(conversation_history)
        if scenario_key is None:
            return _NO_API_KEY_RESPONSE

        responses = _DEMO_SCENARIOS[scenario_key]["responses"]
        if turn_number < len(responses):
            return responses[turn_number]

        # All demo turns exhausted — push to masterplan
        return {
            "message": "I have enough context now. Generating your masterplan...",
            "eval_delta": {
                "problem_clarity": max(0.0, 0.9 - current_scores.get("problem_clarity", 0)),
                "scale_constraints": max(0.0, 0.9 - current_scores.get("scale_constraints", 0)),
                "tech_context": max(0.0, 0.9 - current_scores.get("tech_context", 0)),
                "success_definition": max(0.0, 0.9 - current_scores.get("success_definition", 0)),
                "risk_awareness": max(0.0, 0.9 - current_scores.get("risk_awareness", 0)),
            },
            "new_assumptions": [],
            "phase": "masterplan",
        }

    system_prompt = """You are Socra — an expert AI architect who refuses to generate solutions until you fully understand the problem.

Your job is to interrogate, debate, and stress-test project ideas through Socratic dialogue.

CURRENT EVALUATION SCORES (0.0 to 1.0):
- Problem Clarity: {problem_clarity}
- Scale & Constraints: {scale_constraints}
- Tech Context: {tech_context}
- Success Definition: {success_definition}
- Risk Awareness: {risk_awareness}

TOTAL SCORE: {total:.0%}

RULES:
1. Ask maximum 2-3 targeted questions per turn. Never more.
2. If score < 0.4: Stay in intake phase, ask clarifying questions
3. If score 0.4-0.7: Enter debate phase — propose approaches and argue against them
4. If score 0.7-0.85: Enter stress-test phase — challenge with failure scenarios
5. If score > 0.85: Generate the masterplan

RESPOND ONLY WITH VALID JSON (no markdown, no preamble):
{{
  "message": "your response to the user (markdown supported)",
  "eval_delta": {{
    "problem_clarity": 0.0,
    "scale_constraints": 0.0,
    "tech_context": 0.0,
    "success_definition": 0.0,
    "risk_awareness": 0.0
  }},
  "new_assumptions": ["assumption 1", "assumption 2"],
  "phase": "intake|debate|stress_test|masterplan",
  "choices": ["concise option 1", "concise option 2", "concise option 3", "concise option 4"]
}}

eval_delta values should be small positive increments (0.05-0.25) reflecting how much this turn improved each dimension.
If phase is "masterplan", the message should be the complete architectural masterplan in markdown and choices must be [].
Always include 3-4 choices that represent the most archetypal user responses to the questions you just asked. Keep each choice under 12 words and make them meaningfully distinct from each other."""

    formatted_system = system_prompt.format(**current_scores, total=sum(current_scores.values()) / 5)
    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    raw = await _call_real_llm(formatted_system, msgs, max_tokens=2000, json_mode=True)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse LLM response as JSON: {raw[:200]}")


async def generate_masterplan(conversation_history: list[dict]) -> str:
    if settings.is_stub:
        await asyncio.sleep(random.uniform(1.5, 2.5))
        scenario_key = _detect_scenario(conversation_history)
        if scenario_key:
            return _DEMO_SCENARIOS[scenario_key]["masterplan"]
        return "# Masterplan\n\nSet `ANTHROPIC_API_KEY` in `.env` for a real, idea-specific masterplan."

    system = """You are a staff-level software architect. Based on the full conversation, generate a comprehensive project masterplan in Markdown.

Include:
1. Project summary (2-3 sentences)
2. Recommended architecture with justification
3. Tech stack table with reasoning
4. Implementation phases (3 phases, 4 weeks each)
5. Risk register (top 5 risks, likelihood, impact, mitigation)
6. Monthly cost estimate (at 100 active users)
7. First 3 files to write

Be specific, opinionated, and actionable. No generic advice."""

    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    return await _call_real_llm(system, msgs, max_tokens=3000)


# ---------------------------------------------------------------------------
# Multi-agent masterplan pipeline
# ---------------------------------------------------------------------------

SPECIALIST_AGENTS = [
    {
        "key": "finance",
        "title": "Financial Analysis",
        "icon": "💰",
        "color": "#34d399",
        "prompt": """You are a venture capitalist and financial analyst reviewing a startup idea.

Identify 4-5 specific financial gaps or risks in the conversation:
- Revenue model clarity and viability
- Unit economics (CAC, LTV, payback period)
- Funding requirements and runway concerns
- Cost structure and burn rate
- Path to profitability

Format as 4-5 bullet points. Be direct and specific. Under 180 words.""",
    },
    {
        "key": "market",
        "title": "Market Analysis",
        "icon": "📈",
        "color": "#5590e8",
        "prompt": """You are a market research expert reviewing a startup idea.

Identify 4-5 specific market gaps or risks:
- TAM/SAM/SOM realism
- Market timing and readiness
- Customer segment clarity
- Go-to-market strategy weaknesses
- Distribution challenges

Format as 4-5 bullet points. Be direct and specific. Under 180 words.""",
    },
    {
        "key": "competition",
        "title": "Competitive Landscape",
        "icon": "⚔️",
        "color": "#f59e0b",
        "prompt": """You are a competitive intelligence analyst reviewing a startup idea.

Identify 4-5 specific competitive risks:
- Name the real competitors (be specific, use real company names)
- Differentiation weaknesses
- Why incumbents have structural advantages
- Moat viability
- How the market could respond to this entry

Format as 4-5 bullet points. Name real companies. Under 180 words.""",
    },
    {
        "key": "tech",
        "title": "Technical Assessment",
        "icon": "⚙️",
        "color": "#22d3ee",
        "prompt": """You are a principal software architect reviewing a startup idea.

Identify 4-5 specific technical risks or unknowns:
- Technical feasibility concerns
- Architecture risks and hidden complexity
- Build vs buy decisions needed
- Key technical unknowns that could derail
- What breaks first at scale

Be specific about technology choices. Format as 4-5 bullet points. Under 180 words.""",
    },
    {
        "key": "risk",
        "title": "Risk & Scalability",
        "icon": "⚠️",
        "color": "#e85d26",
        "prompt": """You are a startup risk analyst reviewing a startup idea.

Identify 4-5 critical risks:
- Top failure modes specific to this type of idea
- Regulatory or legal exposure
- Platform or dependency risks
- What breaks first at 10x scale
- The single assumption that, if wrong, kills everything

Be direct. Format as 4-5 bullet points. Under 180 words.""",
    },
]


async def _call_fast_llm(system: str, messages: list[dict]) -> str:
    """Cheaper/faster model for specialist agents."""
    if settings.anthropic_api_key:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=system,
            messages=messages,
        )
        return response.content[0].text
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
    response = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        max_tokens=400,
        messages=[{"role": "system", "content": system}, *messages],
    )
    return response.choices[0].message.content or ""


async def run_specialist_agent(agent_cfg: dict, conversation_history: list[dict]) -> dict:
    """Run a single specialist agent and return its analysis report."""
    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    try:
        content = await _call_fast_llm(agent_cfg["prompt"], msgs)
    except Exception as e:
        content = f"_Analysis unavailable ({str(e)[:60]})_"
    return {
        "key": agent_cfg["key"],
        "title": agent_cfg["title"],
        "icon": agent_cfg["icon"],
        "color": agent_cfg["color"],
        "content": content,
    }


def _build_synthesis_prompt(agent_reports: list[dict]) -> str:
    reports_text = "\n\n".join(
        f"### {r['title']}\n{r['content']}" for r in agent_reports
    )
    return f"""You are a senior startup advisor synthesizing domain expert analyses into a final masterplan.

Five specialist agents have analyzed this startup idea:

{reports_text}

Using ALL of the above findings AND the full conversation history, write a comprehensive masterplan that:
1. Directly addresses the key risks each specialist identified
2. Proposes specific, concrete solutions — not just observations
3. Defines a 3-phase roadmap (Phase 1: MVP, Phase 2: Growth, Phase 3: Scale/Moat)
4. Gives opinionated, specific technology and GTM recommendations
5. Includes a risk register that synthesizes the agents' top findings

Format as clean Markdown with clear section headers. Be specific and actionable. No generic advice."""


async def _stream_synthesis_tokens(system: str, messages: list[dict]):
    """Stream synthesis using the larger/better model regardless of the main model setting."""
    if settings.anthropic_api_key:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
        stream = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=3000,
            messages=[{"role": "system", "content": system}, *messages],
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


async def stream_multi_agent_masterplan(conversation_history: list[dict]):
    """
    Async generator for the multi-agent masterplan pipeline.
    Yields:
      {"type": "agent_report", "report": {...}}   — as each specialist completes
      {"type": "synthesis_token", "delta": str}   — synthesis streaming tokens
      {"type": "synthesis_done", "text": str}     — final full synthesis text
    """
    if settings.is_stub:
        scenario_key = _detect_scenario(conversation_history)
        for agent_cfg in SPECIALIST_AGENTS:
            await asyncio.sleep(0.4)
            yield {
                "type": "agent_report",
                "report": {
                    "key": agent_cfg["key"],
                    "title": agent_cfg["title"],
                    "icon": agent_cfg["icon"],
                    "color": agent_cfg["color"],
                    "content": f"_Demo mode — {agent_cfg['title'].lower()} would appear here with real API keys._",
                },
            }
        text = (
            _DEMO_SCENARIOS[scenario_key]["masterplan"]
            if scenario_key
            else "# Masterplan\n\nSet API keys for a real multi-agent analysis."
        )
        yield {"type": "synthesis_done", "text": text}
        return

    # Phase 1: run all specialist agents in parallel, yield as each completes
    tasks = [
        asyncio.create_task(run_specialist_agent(agent_cfg, conversation_history))
        for agent_cfg in SPECIALIST_AGENTS
    ]
    agent_reports: list[dict] = []
    pending = set(tasks)

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            report = await task
            agent_reports.append(report)
            yield {"type": "agent_report", "report": report}

    # Phase 2: stream synthesis — use the larger model for better masterplan quality
    synthesis_system = _build_synthesis_prompt(agent_reports)
    msgs = [{"role": m["role"], "content": m["content"]} for m in conversation_history]
    synthesis_text = ""

    try:
        async for token in _stream_synthesis_tokens(synthesis_system, msgs):
            synthesis_text += token
            yield {"type": "synthesis_token", "delta": token}
    except Exception:
        pass

    yield {"type": "synthesis_done", "text": synthesis_text}
