import { useState, useEffect, useRef } from 'react'
// @ts-ignore
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react'
import { useSessionStore } from '../store/sessionStore'
import { CLERK_ENABLED } from '../lib/auth'

// ─── Auth helpers ────────────────────────────────────────────────────────────

function AuthButton() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!isLoaded) return null
  if (isSignedIn) return <UserButton afterSignOutUrl="/" />
  return (
    <button onClick={() => openSignIn()}
      className="text-xs font-mono text-ink-500 hover:text-ink-300 border border-ink-800 hover:border-ink-700 px-3 py-1.5 rounded-lg transition-all">
      Sign in
    </button>
  )
}

function SyncNudge() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!isLoaded || isSignedIn) return null
  return (
    <button onClick={() => openSignIn()} className="text-[11px] font-mono text-amber-400/50 hover:text-amber-400 transition-colors">
      Sign in to sync →
    </button>
  )
}

// ─── Animated demo ────────────────────────────────────────────────────────────

const DIMS = [
  { id: 'pc', label: 'Problem Clarity',    color: '#f59e0b' },
  { id: 'sc', label: 'Scale & Constraints', color: '#5590e8' },
  { id: 'tc', label: 'Tech Context',        color: '#22d3ee' },
  { id: 'sd', label: 'Success Definition',  color: '#a78bfa' },
  { id: 'ra', label: 'Risk Awareness',      color: '#34d399' },
]

type Dims = { pc: number; sc: number; tc: number; sd: number; ra: number }
type DemoPhase = 'eval' | 'agents' | 'pitch' | 'debate'

interface DemoState {
  phase: DemoPhase
  dims: Dims
  total: number
  showMsg: boolean
  showChallenge: boolean
  searching: boolean
  agentCount: number
  showBull: boolean
  showBear: boolean
  showVerdict: boolean
}

const D0: DemoState = {
  phase: 'eval',
  dims: { pc: 0, sc: 0, tc: 0, sd: 0, ra: 0 },
  total: 0,
  showMsg: false,
  showChallenge: false,
  searching: false,
  agentCount: 0,
  showBull: false,
  showBear: false,
  showVerdict: false,
}

const DEMO_AGENTS = [
  { icon: '🌐', title: 'Market Research', color: '#22d3ee',  snippet: 'TAM ~$4.2B globally, growing 18% YoY. India segment underpenetrated — only 3 scaled players.' },
  { icon: '🏗',  title: 'System Architect', color: '#a78bfa', snippet: 'Next.js frontend, PostgreSQL + PostGIS, Stripe Connect for payouts, Redis for availability cache.' },
  { icon: '⚠️', title: 'Risk Assessor',   color: '#e85d26', snippet: 'Critical: cold-start liquidity problem. Without 50+ listings at launch, workers churn on day one.' },
]

const PHASE_TABS: { key: DemoPhase; label: string }[] = [
  { key: 'eval',   label: '① Eval' },
  { key: 'agents', label: '② Agents' },
  { key: 'pitch',  label: '③ Pitch' },
  { key: 'debate', label: '④ Debate' },
]

function LiveDemo() {
  const [demo, setDemo] = useState<DemoState>(D0)
  const upd = (patch: Partial<DemoState>) => setDemo(s => ({ ...s, ...patch }))

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => ids.push(setTimeout(fn, ms))

    function run() {
      // ── Phase 1: Eval bar + conversation (0–9s) ──────────────────────────
      setDemo(D0)
      at(300,  () => upd({ dims: { pc: 25, sc: 0, tc: 0, sd: 0, ra: 0 }, total: 10 }))
      at(1200, () => upd({ showMsg: true }))
      at(2300, () => upd({ showChallenge: true }))
      at(3400, () => upd({ dims: { pc: 70, sc: 45, tc: 0,  sd: 0,  ra: 0  }, total: 34 }))
      at(5000, () => upd({ dims: { pc: 70, sc: 45, tc: 60, sd: 55, ra: 0  }, total: 62 }))
      at(6800, () => upd({ dims: { pc: 80, sc: 80, tc: 85, sd: 80, ra: 75 }, total: 90 }))

      // ── Phase 2: Specialist agents (9–15s) ───────────────────────────────
      at(9000,  () => upd({ phase: 'agents', searching: true, agentCount: 0 }))
      at(10300, () => upd({ searching: false, agentCount: 1 }))
      at(11600, () => upd({ agentCount: 2 }))
      at(12900, () => upd({ agentCount: 3 }))

      // ── Phase 3: Pitch deck (15–21s) ─────────────────────────────────────
      at(15500, () => upd({ phase: 'pitch' }))

      // ── Phase 4: Debate (21–27s) ──────────────────────────────────────────
      at(21000, () => upd({ phase: 'debate' }))
      at(21600, () => upd({ showBull: true }))
      at(23000, () => upd({ showBear: true }))
      at(24800, () => upd({ showVerdict: true }))

      // ── Loop ──────────────────────────────────────────────────────────────
      ids.push(setTimeout(run, 28000))
    }

    run()
    return () => ids.forEach(clearTimeout)
  }, [])

  const statusText =
    demo.total >= 88 ? '✓ ready to generate'   :
    demo.total >= 60 ? '◕ almost there…'        :
    demo.total >= 30 ? '◑ building picture…'    :
                       '⟳ gathering context…'

  return (
    <div className="rounded-2xl border border-ink-800/60 overflow-hidden"
      style={{ background: 'rgba(13,12,11,0.95)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-800/50"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#e05555]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#e8a030]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#3cba82]" />
        <span className="ml-2 text-[11px] font-mono text-ink-700 flex-1">socra — architect session</span>
        {/* Phase tabs */}
        <div className="flex items-center gap-1">
          {PHASE_TABS.map(t => (
            <span key={t.key}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md transition-all duration-500"
              style={{
                color: demo.phase === t.key ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                background: demo.phase === t.key ? 'rgba(245,158,11,0.1)' : 'transparent',
              }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5 min-h-[320px]">

        {/* ── Phase 1: Eval + chat ─────────────────────────────────────────── */}
        {demo.phase === 'eval' && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700 mb-2.5">Context Score</p>
              <div className="space-y-2 mb-3">
                {DIMS.map(d => {
                  const val = demo.dims[d.id as keyof Dims]
                  return (
                    <div key={d.id} className="grid items-center gap-3" style={{ gridTemplateColumns: '120px 1fr 28px' }}>
                      <span className="text-[11px] text-ink-500">{d.label}</span>
                      <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-[1400ms] ease-[cubic-bezier(.4,0,.2,1)]"
                          style={{ width: `${val}%`, background: d.color, boxShadow: val > 0 ? `0 0 8px ${d.color}60` : 'none' }} />
                      </div>
                      <span className="text-[10px] font-mono text-ink-600 text-right tabular-nums">{val}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[11px] text-ink-500">Overall readiness</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-ink-600">{statusText}</span>
                  <span className="font-display text-lg text-amber-400 tabular-nums">{demo.total}%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-mono text-blue-400 flex-shrink-0 mt-0.5">U</div>
                <div className="text-[12px] text-ink-300 px-3 py-2 rounded-xl flex-1"
                  style={{ background: 'rgba(85,144,232,0.07)', border: '1px solid rgba(85,144,232,0.12)' }}>
                  I want to build an app like Airbnb for co-working spaces
                </div>
              </div>
              {demo.showMsg && (
                <div className="flex gap-2 fade-up">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] font-mono text-amber-400 flex-shrink-0 mt-0.5">S</div>
                  <div className="text-[12px] text-ink-400 leading-relaxed flex-1">
                    <strong className="text-ink-200">Before I touch any model</strong> — who is the primary user? The desk-seeker, or the office owner? Your entire data model changes based on that answer.
                  </div>
                </div>
              )}
              {demo.showChallenge && (
                <div className="ml-8 text-[11px] text-ink-500 px-3 py-2 rounded-lg leading-relaxed fade-up"
                  style={{ background: 'rgba(224,85,85,0.05)', border: '1px solid rgba(224,85,85,0.12)' }}>
                  <span className="text-[10px] font-mono text-[#e05555] mr-1.5">⚡ CHALLENGE —</span>
                  Airbnb took 10 years and $6B to build marketplace trust. What's your day-one plan for the chicken-and-egg problem?
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phase 2: Specialist agents ───────────────────────────────────── */}
        {demo.phase === 'agents' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Specialist Analysis</p>
              <span className="text-[10px] font-mono text-ink-800 tabular-nums">{demo.agentCount} / 3</span>
            </div>
            {demo.searching && (
              <div className="flex items-center gap-2 fade-up">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[11px] font-mono text-blue-400/80 animate-pulse">Searching the web for market data…</span>
              </div>
            )}
            {DEMO_AGENTS.slice(0, demo.agentCount).map((a) => (
              <div key={a.title} className="rounded-xl border px-4 py-3 fade-up"
                style={{ borderColor: `${a.color}22`, background: `${a.color}06` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base">{a.icon}</span>
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider"
                    style={{ color: a.color }}>{a.title}</span>
                </div>
                <p className="text-[12px] text-ink-500 leading-relaxed">{a.snippet}</p>
              </div>
            ))}
            {demo.agentCount < 3 && !demo.searching && (
              <div className="rounded-xl border border-ink-800/40 px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-ink-700/60 border-t-transparent animate-spin flex-shrink-0" />
                <span className="text-[11px] font-mono text-ink-800">Analyzing…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Phase 3: Pitch deck ──────────────────────────────────────────── */}
        {demo.phase === 'pitch' && (
          <div className="space-y-3 fade-up">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Pitch Deck</p>
              <span className="text-[10px] font-mono text-amber-500/50">Slide 01 of 09</span>
            </div>
            <div className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.03)' }}>
              <div className="px-4 py-2 border-b flex items-center gap-2"
                style={{ borderColor: 'rgba(245,158,11,0.1)', background: 'rgba(245,158,11,0.04)' }}>
                <span className="text-[10px] font-mono text-amber-500/70 uppercase tracking-wider">🏢 The Problem</span>
              </div>
              <div className="px-4 py-4">
                <p className="text-[14px] font-semibold text-ink-100 mb-3 leading-snug">
                  Co-workers lose 4+ hours per week hunting for flexible workspace
                </p>
                <div className="space-y-1.5">
                  {[
                    '42M remote workers in India — market is massive and fragmented',
                    'Avg ₹8,000/month wasted on unused coworking memberships',
                    'No unified marketplace with real-time availability exists today',
                  ].map((b) => (
                    <div key={b} className="flex gap-2 text-[12px] text-ink-500">
                      <span className="text-amber-500/50 flex-shrink-0 mt-0.5">·</span>{b}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <span className="text-[10px] font-mono text-amber-500/40 border border-amber-500/15 px-2.5 py-0.5 rounded-lg">
                Export as HTML →
              </span>
            </div>
          </div>
        )}

        {/* ── Phase 4: Debate ──────────────────────────────────────────────── */}
        {demo.phase === 'debate' && (
          <div className="space-y-3 fade-up">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">⚔️</span>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">AI Debate · Round 1: Opening Arguments</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demo.showBull && (
                <div className="rounded-xl border px-3 py-3 fade-up"
                  style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider">Bull</span>
                  </div>
                  <p className="text-[12px] text-ink-400 leading-relaxed">
                    Remote work is permanently mainstream. 300M+ flexible workers need this. The market is fragmented — perfect for a marketplace play.
                  </p>
                </div>
              )}
              {demo.showBear && (
                <div className="rounded-xl border px-3 py-3 fade-up"
                  style={{ borderColor: 'rgba(239,68,68,0.18)', background: 'rgba(239,68,68,0.04)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-[10px] font-mono text-red-400/60 uppercase tracking-wider">Bear</span>
                  </div>
                  <p className="text-[12px] text-ink-400 leading-relaxed">
                    WeWork burned $47B proving space unit economics are brutal. You need 80%+ utilisation before a single location breaks even.
                  </p>
                </div>
              )}
            </div>
            {demo.showVerdict && (
              <div className="rounded-xl border px-3 py-2.5 fade-up"
                style={{ borderColor: 'rgba(99,102,241,0.18)', background: 'rgba(99,102,241,0.04)' }}>
                <span className="text-[10px] font-mono text-indigo-400/50 uppercase tracking-wider mr-2">Verdict</span>
                <span className="text-[12px] text-ink-400">
                  Timing is right, but validate utilisation economics with 3 pilot locations before scaling.
                </span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Section helpers ──────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  intake: '#55545c', debate: '#f59e0b', stress_test: '#e85d26', masterplan: '#34d399',
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-700 mb-4">{children}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display font-bold leading-[1.1] tracking-tight mb-10"
      style={{ fontSize: 'clamp(26px, 3.5vw, 42px)' }}>
      {children}
    </h2>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const [idea, setIdea] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  // Compare flow: store the first selected session ID (pre-seeded from ?compare= param)
  const [compareId, setCompareId] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('compare')
  })
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { createSession, isLoading, sessionError, sessionHistory, resumeSession } = useSessionStore()

  const handleCompareClick = (id: string) => {
    if (compareId === id) {
      // Deselect
      setCompareId(null)
    } else if (compareId) {
      // Navigate to compare page
      window.location.href = `/compare/${compareId}/${id}`
    } else {
      // Select as first session
      setCompareId(id)
    }
  }

  const handleSubmit = async () => {
    const trimmed = idea.trim()
    if (!trimmed || isLoading) return
    await createSession(trimmed)
  }

  const handleWaitlist = async () => {
    const email = waitlistEmail.trim()
    if (!email.includes('@')) {
      setWaitlistError('Please enter a valid email address.')
      return
    }
    setWaitlistLoading(true)
    setWaitlistError('')
    try {
      // @ts-ignore
      const apiUrl = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      if (data.status === 'already_registered') {
        setWaitlistDone(true)
      } else {
        setWaitlistDone(true)
      }
    } catch {
      setWaitlistError('Something went wrong. Please try again.')
    } finally {
      setWaitlistLoading(false)
    }
  }

  const examples = [
    'A SaaS platform where developers can collaboratively review and annotate API documentation',
    'A marketplace for freelance ML engineers to bid on short-term data labeling contracts',
    'A mobile app that tracks grocery prices across local stores using receipt scanning',
  ]

  const features = [
    { icon: '📊', title: 'Live Evaluation Bar', desc: 'Real-time score across 5 dimensions — problem clarity, scale, tech context, success definition, risk. Masterplan unlocks only when context is sufficient.', tag: 'Core', tc: '#5590e8' },
    { icon: '🔍', title: 'Assumption Tracker', desc: 'Every hidden assumption surfaced as a clickable chip. Mark each one validated or disproved — the analysis updates accordingly.', tag: 'Core', tc: '#e85d26' },
    { icon: '🤖', title: '5 Specialist Agents', desc: 'Market analyst, system architect, risk assessor, financial modeler, and growth strategist run in parallel — each with real web research behind them.', tag: 'Core', tc: '#a78bfa' },
    { icon: '🌐', title: 'Web Research', desc: 'Agents search the web for real competitor data, market sizing, and pricing benchmarks before writing their reports. No hallucinated numbers.', tag: 'Core', tc: '#22d3ee' },
    { icon: '💀', title: "Devil's Advocate", desc: '5 hard reasons your idea fails — regulatory risk, unit economics, timing, competition, execution. The reality check before you commit.', tag: 'Core', tc: '#e05555' },
    { icon: '📑', title: 'Investor Pitch Deck', desc: '9 slide-ready cards generated from your masterplan — problem, solution, market, traction, business model, competition, team, financials, and ask. Export as interactive HTML.', tag: 'Output', tc: '#f59e0b' },
    { icon: '⚔️', title: 'AI Debate Mode', desc: 'Bull (VC optimist) vs Bear (operator skeptic) across 3 structured rounds with a final verdict. See your idea stress-tested from both sides.', tag: 'Output', tc: '#34d399' },
    { icon: '↔️', title: 'Idea Comparison', desc: 'Compare two masterplans side by side — scores, agent reports, and architecture. Useful when you\'re deciding between two directions.', tag: 'Output', tc: '#f59e0b' },
    { icon: '🗺️', title: 'Architecture Masterplan', desc: 'Full markdown document: system design, tech stack, data model, API contracts, scaling strategy, and risk register. Exportable as .md or shareable via link.', tag: 'Core', tc: '#34d399' },
  ]

  return (
    <div className="min-h-screen text-ink-50" style={{ background: '#080809' }}>

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-25%] left-1/2 -translate-x-1/2 w-[1000px] h-[700px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse, #f59e0b 0%, transparent 70%)' }} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-ink-800/40"
        style={{ background: 'rgba(8,8,9,0.88)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 8px #f59e0b' }} />
            <span className="text-[13px] font-display font-bold text-ink-100 tracking-tight">Socra</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            {['How it works', 'Features', 'Pricing'].map((l, i) => (
              <a key={l} href={`#${['how', 'features', 'pricing'][i]}`}
                className="text-[13px] text-ink-600 hover:text-ink-300 transition-colors">{l}</a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {CLERK_ENABLED && <AuthButton />}
          <a href="#waitlist"
            className="text-[13px] font-semibold px-4 py-1.5 rounded-lg transition-all"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#e85d26)', color: '#080809' }}>
            Get early access
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono text-amber-400/60 border border-amber-400/15 bg-amber-400/5 px-3.5 py-1.5 rounded-full mb-8">
          <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
          AI Architect · Private Beta
        </div>

        <h1 className="font-display font-bold leading-[1.04] tracking-[-1px] mb-6 max-w-3xl"
          style={{ fontSize: 'clamp(40px, 6vw, 70px)' }}>
          <span className="text-ink-100">The AI that </span>
          <span className="italic text-amber-400" style={{ textShadow: '0 0 60px rgba(245,158,11,0.35)' }}>argues back</span>
          <br />
          <span className="text-ink-100">before you </span>
          <span className="text-ink-400">waste the build.</span>
        </h1>

        <p className="text-ink-400 leading-relaxed max-w-xl mx-auto mb-10" style={{ fontSize: '17px' }}>
          Describe your project. Socra interrogates your idea, debates your approach,
          and stress-tests your assumptions — before a single line of code is written.
        </p>

        {/* Input card */}
        <div className="w-full max-w-[600px] relative group mb-4">
          <div className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(232,93,38,0.15))', filter: 'blur(1px)' }} />
          <div className="relative rounded-2xl overflow-hidden border border-ink-700/60 group-focus-within:border-amber-500/30 transition-colors duration-300"
            style={{ background: 'rgba(15,14,12,0.98)' }}>
            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="I want to build a platform where..."
              rows={4}
              className="w-full bg-transparent px-5 pt-4 pb-3 text-[15px] text-ink-100 placeholder-ink-700 resize-none focus:outline-none leading-relaxed"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSubmit() }}
            />
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-ink-800/60">
              <span className="text-[11px] text-ink-800 font-mono">⌘↵ to start</span>
              <button onClick={handleSubmit} disabled={!idea.trim() || isLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-30"
                style={{
                  background: idea.trim() && !isLoading ? 'linear-gradient(135deg,#f59e0b,#e85d26)' : 'rgba(35,33,28,0.9)',
                  color: idea.trim() && !isLoading ? '#08070a' : '#4a4840',
                  boxShadow: idea.trim() && !isLoading ? '0 0 28px rgba(245,158,11,0.25)' : 'none',
                }}>
                {isLoading
                  ? <><div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />Starting…</>
                  : 'Start session →'}
              </button>
            </div>
          </div>
          {sessionError && (
            <p className="text-[12px] text-red-400/80 font-mono mt-3 text-center">{sessionError}</p>
          )}
        </div>

        {/* Proof row */}
        <div className="flex items-center justify-center gap-5 mb-10 flex-wrap">
          {['5 specialist AI agents', 'Real web research', 'Investor pitch deck', 'Bull vs Bear debate'].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-ink-700" />
              <span className="text-[11px] text-ink-700 font-mono">{t}</span>
            </div>
          ))}
        </div>

        {/* Examples */}
        <div className="w-full max-w-[600px]">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-800 mb-3">or try an example</p>
          <div className="flex flex-col gap-1.5">
            {examples.map((ex, i) => (
              <button key={i} onClick={() => { setIdea(ex); inputRef.current?.focus() }}
                className="group text-left px-4 py-3 rounded-xl border border-ink-800/40 hover:border-ink-700/60 hover:bg-ink-900/30 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-ink-800 group-hover:text-ink-700 mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[13px] text-ink-600 group-hover:text-ink-400 transition-colors leading-relaxed">{ex}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        {sessionHistory.length > 0 && (
          <div className="w-full max-w-[600px] mt-8 border-t border-ink-800/40 pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Recent sessions</span>
              <div className="flex items-center gap-3">
                {compareId && (
                  <span className="text-[10px] font-mono text-amber-400/70 animate-pulse">
                    ↔ Select another to compare
                  </span>
                )}
                {CLERK_ENABLED && <SyncNudge />}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {sessionHistory.slice(0, 6).map((s) => {
                const isSelected = s.id === compareId
                return (
                  <div key={s.id}
                    className="group flex items-center gap-2 rounded-xl border transition-all"
                    style={{
                      borderColor: isSelected ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)',
                      background: isSelected ? 'rgba(245,158,11,0.05)' : 'transparent',
                    }}>
                    <button onClick={() => resumeSession(s.id)} disabled={isLoading}
                      className="flex-1 text-left px-4 py-3 flex items-center gap-3 min-w-0">
                      <p className="flex-1 text-[13px] text-ink-600 group-hover:text-ink-400 transition-colors truncate leading-relaxed">{s.initial_idea}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {s.has_masterplan && <span className="text-[10px] font-mono text-emerald-500/60">✓</span>}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{
                          color: PHASE_COLORS[s.phase] ?? '#55545c',
                          borderColor: `${PHASE_COLORS[s.phase] ?? '#55545c'}30`,
                          background: `${PHASE_COLORS[s.phase] ?? '#55545c'}08`,
                        }}>
                          {Math.round(s.total_score * 100)}%
                        </span>
                      </div>
                    </button>
                    {s.has_masterplan && (
                      <button
                        onClick={() => handleCompareClick(s.id)}
                        title={isSelected ? 'Deselect' : compareId ? 'Compare with selected' : 'Select to compare'}
                        className={`px-3 py-3 text-[11px] font-mono transition-colors flex-shrink-0 rounded-r-xl hover:text-amber-400 ${isSelected ? 'text-amber-500' : 'text-white/20'}`}
                      >
                        ↔
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Ticker ───────────────────────────────────────────────────────────── */}
      <div className="border-y border-ink-800/40 py-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="ticker-track flex gap-0">
          {[...Array(2)].flatMap(() =>
            ['5 specialist agents', 'Real web research', 'Investor pitch deck', 'Bull vs Bear debate', 'Devil\'s advocate', 'Assumption tracker', 'Architecture masterplan', 'Interactive HTML export', 'Idea comparison', 'Share + export'].map((t) => (
              <span key={t + Math.random()} className="flex items-center gap-2 px-8 text-[12px] font-mono text-ink-700">
                {t} <span className="text-amber-500/40">◆</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* ── Demo ─────────────────────────────────────────────────────────────── */}
      <section id="how" className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <SectionBadge>Live demo</SectionBadge>
            <SectionHeading>
              Watch the eval bar fill<br />
              <em className="text-amber-400 not-italic">as Socra interrogates.</em>
            </SectionHeading>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionBadge>The problem</SectionBadge>
          <SectionHeading>
            Most teams start building before<br />
            they understand <em className="text-amber-400 not-italic">what</em> they're building.
          </SectionHeading>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-6 border" style={{ background: 'rgba(224,85,85,0.04)', borderColor: 'rgba(224,85,85,0.15)' }}>
              <p className="text-[12px] font-mono font-semibold text-[#e05555] uppercase tracking-wider mb-5">✕ Without Socra</p>
              {[
                'Vague prompt → garbage output → retry 10 times',
                'Burn ₹40,000 in API credits on trial and error',
                'Architecture decided in 5 minutes, regretted in 5 months',
                'Nobody challenged the core assumption before building',
                'No documentation of why decisions were made',
              ].map((t) => (
                <div key={t} className="flex gap-2.5 text-[13px] text-ink-500 mb-3 leading-snug">
                  <span className="text-ink-700 flex-shrink-0">→</span>{t}
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-6 border" style={{ background: 'rgba(60,186,130,0.04)', borderColor: 'rgba(60,186,130,0.15)' }}>
              <p className="text-[12px] font-mono font-semibold text-emerald-400 uppercase tracking-wider mb-5">✓ With Socra</p>
              {[
                '5 specialist agents research your market in parallel — real data, not guesses',
                'Architecture masterplan with stack, data model, API contracts, and risk register',
                'Every assumption surfaced and confirmed before a line is written',
                'Investor pitch deck generated and exported as interactive HTML',
                'Bull vs Bear debate surfaces the best and worst case before you commit',
              ].map((t) => (
                <div key={t} className="flex gap-2.5 text-[13px] text-ink-400 mb-3 leading-snug">
                  <span className="text-emerald-600 flex-shrink-0">→</span>{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionBadge>What Socra does</SectionBadge>
          <SectionHeading>
            From raw idea to investor-ready output —<br />
            <em className="text-amber-400 not-italic">before a line of code is written.</em>
          </SectionHeading>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title}
                className="group rounded-2xl overflow-hidden border border-ink-800/50 hover:border-ink-700/70 transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'rgba(255,255,255,0.015)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 32px ${f.tc}14` }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}>
                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${f.tc}90, ${f.tc}15)` }} />
                <div className="p-5">
                  <div className="text-2xl mb-4">{f.icon}</div>
                  <h3 className="text-[14px] font-semibold text-ink-200 mb-2">{f.title}</h3>
                  <p className="text-[13px] text-ink-600 leading-relaxed mb-3">{f.desc}</p>
                  <span className="inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded-full"
                    style={{ color: f.tc, background: `${f.tc}12`, border: `1px solid ${f.tc}25` }}>
                    {f.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <SectionBadge>Pricing</SectionBadge>
          <SectionHeading>One price. No surprises.</SectionHeading>
          <p className="text-ink-500 mb-10" style={{ fontSize: '15px' }}>
            The conversation is free. Pay only when your masterplan is ready.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 text-left mb-6">
            {/* Free */}
            <div className="rounded-2xl p-6 border border-ink-800/50" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[12px] font-mono font-semibold text-ink-600 uppercase tracking-wider mb-3">Conversation</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-display text-4xl font-bold text-ink-100">Free</span>
              </div>
              <p className="text-[13px] text-ink-600 mb-5">Always — no account needed</p>
              <div className="space-y-2 mb-6">
                {[
                  'Full Socratic interrogation',
                  'Live 5-dimension eval bar',
                  'Assumption tracker',
                  'Quick-reply choices',
                ].map(f => (
                  <div key={f} className="flex gap-2 text-[13px] text-ink-400">
                    <span className="text-emerald-500/70">✓</span>{f}
                  </div>
                ))}
              </div>
              <a href="#start" className="block w-full py-2.5 rounded-xl text-[13px] font-semibold text-center text-ink-300 border border-ink-700 hover:border-ink-600 transition-all">
                Start for free
              </a>
            </div>

            {/* Per session */}
            <div className="rounded-2xl p-6 border relative overflow-hidden"
              style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(232,93,38,0.02) 100%)' }}>
              <div className="absolute top-3 right-3 text-[10px] font-mono text-amber-400/70 border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 rounded-full">
                One-time
              </div>
              <p className="text-[12px] font-mono font-semibold text-amber-400/80 uppercase tracking-wider mb-3">Full Analysis</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-display text-4xl font-bold text-ink-100">₹499</span>
                <span className="text-ink-600 mb-1 text-[14px]">/session</span>
              </div>
              <p className="text-[13px] text-ink-600 mb-5">Unlocks when your score is ready</p>
              <div className="space-y-2 mb-6">
                {[
                  '5 specialist AI agents',
                  'Architecture masterplan',
                  "Devil's advocate",
                  'Investor pitch deck',
                  'Bull vs Bear debate',
                  'Shareable score card',
                ].map(f => (
                  <div key={f} className="flex gap-2 text-[13px] text-ink-300">
                    <span className="text-emerald-400">✓</span>{f}
                  </div>
                ))}
              </div>
              <a href="#start"
                className="block w-full py-2.5 rounded-xl text-[13px] font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#e85d26)', color: '#080809', boxShadow: '0 0 24px rgba(245,158,11,0.2)' }}>
                Start your analysis →
              </a>
            </div>
          </div>

          <p className="text-[12px] text-ink-700">
            Payment via Razorpay — UPI, cards, net banking accepted.{' '}
            <a href="#waitlist" className="text-amber-500/60 hover:text-amber-400 transition-colors">
              Need a team plan? Talk to us.
            </a>
          </p>
        </div>
      </section>

      {/* ── Waitlist ─────────────────────────────────────────────────────────── */}
      <section id="waitlist" className="relative z-10 py-24 px-6 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="font-display font-bold leading-[1.06] tracking-tight mb-4"
            style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}>
            Stop building<br /><em className="text-amber-400 not-italic">the wrong thing.</em>
          </h2>
          <p className="text-ink-500 mb-8" style={{ fontSize: '15px' }}>
            Join 240+ developers getting early access. First 100 get 3 months of Pro free.
          </p>
          {waitlistDone ? (
            <div className="px-5 py-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 text-[14px]">
              You're on the list! We'll reach out when early access opens.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex gap-2 flex-wrap justify-center w-full">
                <input type="email" value={waitlistEmail} onChange={e => { setWaitlistEmail(e.target.value); setWaitlistError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleWaitlist() }}
                  placeholder="your@email.com"
                  disabled={waitlistLoading}
                  className="flex-1 min-w-[220px] bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-[14px] text-ink-100 placeholder-ink-700 focus:outline-none focus:border-amber-500/40 transition-colors disabled:opacity-50" />
                <button onClick={handleWaitlist} disabled={waitlistLoading}
                  className="px-5 py-3 rounded-xl text-[14px] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#e85d26)', color: '#080809', boxShadow: '0 0 24px rgba(245,158,11,0.2)' }}>
                  {waitlistLoading ? 'Joining…' : 'Get early access →'}
                </button>
              </div>
              {waitlistError && (
                <p className="text-[12px] text-red-400/80 font-mono">{waitlistError}</p>
              )}
            </div>
          )}
          <p className="text-[12px] text-ink-800 mt-4 font-mono">No spam. No pitch decks. Just early access when we're ready.</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-ink-800/40 px-8 py-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
          <span className="font-display text-[15px] text-ink-600">Socra</span>
        </div>
        <p className="text-[12px] text-ink-800 font-mono">© 2025 Socra. Built in India 🇮🇳</p>
        <div className="flex gap-5">
          {['Twitter', 'LinkedIn', 'GitHub', 'Privacy'].map(l => (
            <a key={l} href="#" className="text-[12px] text-ink-700 hover:text-ink-500 transition-colors">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
