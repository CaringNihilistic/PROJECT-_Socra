# 🧠 Socra — The AI Architect for Real Projects

> **The AI that refuses to answer until it fully understands — and challenges your assumptions before you waste time building the wrong thing.**

Socra is an AI-powered project architect that sits *before* any expensive LLM call. It debates, interrogates, and educates until it has a complete picture of your project — then hands a precision-crafted masterplan to the model of your choice. Stop burning tokens on half-baked prompts.

---

## 🚨 The Problem

| Without Socra | With Socra |
|---|---|
| Vague prompt → garbage output → retry 10 times | Structured debate → expert context → precise output first time |
| Burn ₹500 in API credits on trial and error | One optimized call to the right model |
| Junior dev starts coding wrong system | Staff-engineer-level interrogation before a line is written |
| Architecture decided in 5 minutes | Architecture stress-tested, argued, and documented |

Most people treat AI like a search bar. Socra treats it like a senior engineer who **refuses to code until the problem is actually understood.**

---

## ✨ Core Features

### 🏗️ The Architect Flow
- Classifies incoming requests — simple questions go straight to the model, projects enter the architect flow
- Multi-turn Socratic intake that extracts the full context of your project
- Real-time **Evaluation Bar** that visually scores how well the system understands your project across 5 dimensions
- Debate engine that proposes approaches, then argues against its own proposals
- Stress-testing phase: *"What happens at 10x users?"*, *"What if this third-party API goes down?"*
- Final masterplan handed to the model of your choice only when context is sufficient

### 📊 Evaluation Bar (5 Dimensions)
- **Problem Clarity** — Is the actual problem understood, not just the symptom?
- **Scale & Constraints** — Users, data volume, budget, team size
- **Tech Context** — Existing stack, non-negotiables, flexibility zones
- **Success Definition** — What does "done and working" actually look like?
- **Risk Awareness** — What could kill this project; what's been tried before?

Each dimension fills independently. The bar explains *why* it moved after every exchange.

### 🧑‍🤝‍🧑 Team Mode
- Multiple users join the same architect session
- System detects contradictions between team members and forces alignment
- Shared decision log visible to all participants in real time

### 💬 Devil's Advocate Mode
- A dedicated toggle that argues *only against* the current proposed approach
- Forces genuine defense of architectural decisions
- Great for solo founders who have nobody to pressure-test ideas with

### 🧾 Decision Log
- Every architectural decision is saved with the reasoning behind it
- Full searchable history of *why* things were built a certain way
- Auto-attached to the exported PRD

### 🔍 Assumption Tracker
- System explicitly lists every assumption it is making
- User can correct any assumption mid-conversation
- Recalibrates the entire recommendation when an assumption changes

### 🎯 Jargon Calibration
- Quietly detects technical proficiency from the user's language
- Senior devs get concise, technical answers
- Non-technical founders get full analogies and plain explanations
- Same product, two completely different conversation styles

### 🗺️ Architecture Visualization
- Auto-generates a system diagram after the masterplan is concluded
- Shows components, communication patterns, and scaling risk zones
- Shareable with team or investors

### 💰 Cost Estimator
- After architecture is finalized, estimates actual monthly cloud cost
- Compares naive first approach vs the Socra-optimized approach
- Makes token and money savings tangible and visible

### ⚠️ "What Could Go Wrong" Report
- Top 5 failure risks for the proposed system at scale
- Specific mitigation strategy for each risk
- Generated after the masterplan as a final senior-engineer review

### 📋 Export to PRD
- One-click export of the full session as a structured Product Requirements Document
- Formatted and ready to share with developers, investors, or stakeholders
- Includes decision log, assumptions, architecture diagram, and cost estimate

### 🔄 Version History
- Snapshots of how the architecture evolved across the conversation
- See exactly what changed and what argument caused the pivot
- Good for learning, great for documentation

### 🏛️ Public Architecture Library
- Anonymized past architectures for common project types (SaaS, marketplace, RAG app, mobile backend)
- New users can start from a similar project template
- Library grows over time, building a compounding moat

### 🎙️ Voice Input
- Talk through your project idea instead of typing
- Transcribed, context-extracted, and fed to the architect
- Removes friction for non-technical founders

### 🔀 Model Router
- Sends the final masterplan to Claude, GPT-4, Gemini, or local LLaMA
- Real-time cost comparison: *"GPT-4 → ₹0.80 | Claude Sonnet → ₹0.60 | Local LLaMA → ₹0.00"*
- User chooses based on budget and task type

### 🧠 Memory Across Sessions
- Remembers your tech stack, team size, and past decisions
- References previous projects: *"Last time you chose PostgreSQL — stay consistent?"*
- Builds a persistent profile of each user's technical context

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| API Framework | FastAPI |
| Orchestration | LangChain |
| LLM (debate + architect agent) | Claude Sonnet / GPT-4 via API |
| LLM (classifier) | Fine-tuned LLaMA 3 (1B) |
| Vector DB (memory + library) | FAISS + ChromaDB |
| Task Queue | Celery + Redis |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Real-time (team mode) | WebSockets via FastAPI |
| Voice transcription | Whisper API |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React + TypeScript |
| State management | Zustand |
| Real-time updates | Socket.IO client |
| Diagram rendering | React Flow |
| Styling | Tailwind CSS |

### AI / ML
| Component | Technology |
|---|---|
| Complexity classifier | Fine-tuned LLaMA 3 1B |
| Socratic question generation | LangChain agent + Claude |
| Debate / argument engine | Claude Sonnet (structured prompting) |
| Evaluation bar scoring | Custom rubric + LLM-as-judge |
| Assumption extraction | LangChain NER chain |
| Architecture diagram gen | GPT-4 → Mermaid.js |
| Cost estimation | Custom pricing DB + LLM calculator |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Deployment | Railway / Render (MVP), AWS ECS (scale) |
| CI/CD | GitHub Actions |
| Monitoring | Langfuse (LLM observability) |
| Environment | Python 3.11+, Node 20+ |

---

## 🗂️ Project Structure

```
socra/
├── backend/
│   ├── agents/
│   │   ├── classifier.py          # Complexity classifier (LLaMA)
│   │   ├── intake_agent.py        # Socratic question generator
│   │   ├── debate_agent.py        # Argument + challenge engine
│   │   ├── assumption_tracker.py  # Assumption extraction & management
│   │   └── masterplan_agent.py    # Final architecture generator
│   ├── api/
│   │   ├── routes/
│   │   │   ├── sessions.py        # Project session management
│   │   │   ├── architect.py       # Core architect flow endpoints
│   │   │   ├── export.py          # PRD + diagram export
│   │   │   └── models.py          # Model router endpoints
│   │   └── websockets/
│   │       └── team_session.py    # Real-time team collaboration
│   ├── core/
│   │   ├── eval_bar.py            # Evaluation bar scoring logic
│   │   ├── memory.py              # Cross-session memory (FAISS)
│   │   ├── model_router.py        # Multi-model routing + cost calc
│   │   └── state_machine.py       # Architect flow state manager
│   ├── db/
│   │   ├── models.py
│   │   └── migrations/
│   ├── services/
│   │   ├── voice.py               # Whisper transcription
│   │   ├── diagram.py             # Architecture viz generation
│   │   ├── cost_estimator.py      # Cloud cost estimation
│   │   └── prd_exporter.py        # PRD document generator
│   └── main.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EvalBar/           # The 5-dimension evaluation bar
│   │   │   ├── DebatePanel/       # Conversation + argument UI
│   │   │   ├── AssumptionTracker/ # Live assumption list
│   │   │   ├── ArchDiagram/       # React Flow diagram
│   │   │   ├── CostEstimator/     # Real-time cost comparison
│   │   │   ├── DecisionLog/       # Session decision history
│   │   │   └── ModelSelector/     # Model router UI
│   │   ├── pages/
│   │   ├── store/
│   │   └── hooks/
│   └── package.json
│
├── ml/
│   ├── classifier/
│   │   ├── train.py               # Fine-tune LLaMA complexity classifier
│   │   ├── dataset/               # Synthetic training data
│   │   └── eval.py                # Classifier evaluation
│   └── evals/
│       ├── benchmark.py           # Compare raw vs Socra-processed prompts
│       └── judge.py               # LLM-as-judge scoring
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- API keys: Anthropic, OpenAI (optional), HuggingFace

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/socra.git
cd socra

# Copy environment variables
cp .env.example .env
# Fill in your API keys in .env

# Start all services with Docker
docker-compose up --build

# Or run manually:

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

```env
# LLM APIs
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here          # optional
HUGGINGFACE_TOKEN=your_token_here

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/socra
REDIS_URL=redis://localhost:6379

# Auth
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Vector DB
CHROMA_HOST=localhost
CHROMA_PORT=8001

# Observability
LANGFUSE_PUBLIC_KEY=your_key
LANGFUSE_SECRET_KEY=your_key
```

---

## 📐 How the Architect Flow Works

```
1. User submits project idea
         ↓
2. Complexity Classifier (LLaMA)
   → Simple question? Route directly to model.
   → Project/system? Enter architect flow.
         ↓
3. Intake Phase
   System asks 2-3 most critical missing questions
   [Eval bar starts filling]
         ↓
4. Debate Phase
   System proposes an approach, then argues against it
   User responds, defends, or pivots
   [Bar updates in real time]
         ↓
5. Stress-test Phase
   "What happens at 10x users?"
   "What if this third-party API fails?"
   "Why not a simpler approach?"
         ↓
6. Bar crosses 85% threshold
         ↓
7. Masterplan generated
   → Architecture diagram
   → Cost estimate
   → Risk report
   → Structured expert-level prompt
         ↓
8. Handed to chosen model (Claude / GPT-4 / LLaMA)
         ↓
9. Output + full decision log exported as PRD
```

---

## 📏 Evaluation Bar Scoring

The bar is calculated as a weighted average across 5 dimensions:

| Dimension | Weight | What fills it |
|---|---|---|
| Problem Clarity | 25% | User has articulated the *actual* problem, not just a symptom |
| Scale & Constraints | 20% | Team size, timeline, budget, expected load confirmed |
| Tech Context | 20% | Existing stack, non-negotiables, and flexibility zones known |
| Success Definition | 20% | Clear, measurable definition of "done and working" |
| Risk Awareness | 15% | At least 2 failure modes identified and acknowledged |

**Below 40%** → System refuses to generate output, continues questioning  
**40–70%** → System generates a rough draft with explicit uncertainty flags  
**70–85%** → System generates with minor clarification requests attached  
**Above 85%** → Full masterplan generated with high confidence

---

## 🧪 Evals & Benchmarking

The `ml/evals/` folder contains a benchmark pipeline that:

1. Takes 100 real vague project prompts
2. Runs them raw through Claude/GPT-4
3. Runs them through the Socra architect flow first, then through the same model
4. Scores both outputs using an LLM-as-judge on: accuracy, completeness, architecture quality, and token efficiency

This is the proof that the system works — and it's your portfolio's strongest asset.

```bash
cd ml/evals
python benchmark.py --prompts data/test_prompts.json --model claude-sonnet-4-20250514
```

---

## 🗺️ Roadmap

### MVP (Month 1–2)
- [ ] Core architect flow (intake → debate → masterplan)
- [ ] Evaluation bar (basic scoring, 5 dimensions)
- [ ] FastAPI backend + React frontend
- [ ] Claude + GPT-4 model routing
- [ ] Basic session persistence

### v2 (Month 3–4)
- [ ] Fine-tuned LLaMA classifier
- [ ] Memory across sessions (FAISS)
- [ ] Architecture diagram generation (React Flow)
- [ ] Cost estimator
- [ ] Decision log + assumption tracker
- [ ] Devil's advocate mode

### v3 (Month 5–6)
- [ ] Team mode (WebSockets)
- [ ] Voice input (Whisper)
- [ ] Export to PRD
- [ ] "What could go wrong" risk report
- [ ] Public architecture library
- [ ] Jargon calibration
- [ ] Version history of architectural decisions

### v4 (Scale)
- [ ] Subscription model (free tier capped, pro unlimited)
- [ ] API access for teams to embed Socra in their own tools
- [ ] Self-hosted / local LLaMA option for privacy-sensitive teams
- [ ] IDE plugin (VS Code extension)

---

## 💡 Why This Stands Out as a Portfolio Project

- Covers the full LLM engineer stack: fine-tuning, RAG, agents, evals, FastAPI, multi-model routing
- The eval benchmark in `ml/evals/` gives you *measurable proof* that your system improves output quality
- Solves a real problem that every developer using AI has experienced
- The argumentation layer is genuinely novel — no existing tool argues back
- You can demo it live in any interview: drop a vague project idea in and show the bar filling up

---

## 🤝 Contributing

Contributions welcome. Please open an issue before submitting a large PR so we can align on the approach.

```bash
# Create a branch
git checkout -b feature/your-feature-name

# Make your changes, then
git commit -m "feat: your description"
git push origin feature/your-feature-name
```

---

## 📄 License

MIT License — see `LICENSE` for details.

---

## 👤 Author

Built by [Your Name] — targeting the LLM/AI Engineer role.  
Connect on [LinkedIn](https://linkedin.com) | [Twitter/X](https://x.com)

---

*"The best prompt is the one you never had to write because the system understood you first."*
