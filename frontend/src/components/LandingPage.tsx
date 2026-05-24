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

interface DemoState {
  dims: Dims; total: number; showMsg: boolean; showChallenge: boolean; done: boolean
}

const D0: DemoState = { dims: { pc: 0, sc: 0, tc: 0, sd: 0, ra: 0 }, total: 0, showMsg: false, showChallenge: false, done: false }

function LiveDemo() {
  const [demo, setDemo] = useState<DemoState>(D0)

  const upd = (patch: Partial<DemoState>) => setDemo(s => ({ ...s, ...patch }))

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = []
    const q = (ms: number, fn: () => void) => { ids.push(setTimeout(fn, ms)); return ms }

    function run() {
      upd(D0)
      q(200,  () => upd({ dims: { pc: 20, sc: 0, tc: 0, sd: 0, ra: 0 }, total: 8 }))
      q(1400, () => upd({ showMsg: true }))
      q(2600, () => upd({ showChallenge: true }))
      q(3700, () => upd({ dims: { pc: 65, sc: 0, tc: 0, sd: 0, ra: 0 }, total: 22 }))
      q(4700, () => upd({ dims: { pc: 65, sc: 40, tc: 0, sd: 0, ra: 0 }, total: 28 }))
      q(5700, () => upd({ dims: { pc: 65, sc: 40, tc: 50, sd: 0, ra: 0 }, total: 35 }))
      q(6700, () => upd({ dims: { pc: 80, sc: 40, tc: 50, sd: 0, ra: 0 }, total: 48 }))
      q(7700, () => upd({ dims: { pc: 80, sc: 40, tc: 50, sd: 60, ra: 0 }, total: 58 }))
      q(8700, () => upd({ dims: { pc: 80, sc: 40, tc: 50, sd: 60, ra: 50 }, total: 66 }))
      q(9700, () => upd({ dims: { pc: 80, sc: 80, tc: 50, sd: 60, ra: 50 }, total: 74 }))
      q(10700, () => upd({ dims: { pc: 80, sc: 80, tc: 85, sd: 60, ra: 50 }, total: 82 }))
      q(11700, () => upd({ dims: { pc: 80, sc: 80, tc: 85, sd: 90, ra: 50 }, total: 88 }))
      q(12700, () => upd({ dims: { pc: 80, sc: 80, tc: 85, sd: 90, ra: 80 }, total: 90 }))
      q(13700, () => upd({ done: true }))
      ids.push(setTimeout(() => run(), 17000))
    }

    run()
    return () => ids.forEach(clearTimeout)
  }, [])

  const statusText =
    demo.done      ? '✓ masterplan ready'        :
    demo.total < 40 ? '⟳ gathering context…'     :
    demo.total < 70 ? '◑ building picture…'       :
    demo.total < 85 ? '◕ almost there…'           :
                      '✓ ready to generate'

  return (
    <div className="rounded-2xl border border-ink-800/60 overflow-hidden"
      style={{ background: 'rgba(13,12,11,0.95)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-800/50"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#e05555]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#e8a030]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#3cba82]" />
        <span className="ml-2 text-[11px] font-mono text-ink-700">socra — architect session</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Eval bar */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700 mb-3">Context Score</p>
          <div className="space-y-2.5 mb-3">
            {DIMS.map(d => {
              const val = demo.dims[d.id as keyof Dims]
              return (
                <div key={d.id} className="grid items-center gap-3" style={{ gridTemplateColumns: '130px 1fr 32px' }}>
                  <span className="text-[12px] text-ink-500">{d.label}</span>
                  <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-[1200ms] ease-[cubic-bezier(.4,0,.2,1)]"
                      style={{ width: `${val}%`, background: d.color, boxShadow: val > 0 ? `0 0 8px ${d.color}60` : 'none' }} />
                  </div>
                  <span className="text-[11px] font-mono text-ink-600 text-right tabular-nums">{val}%</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[12px] text-ink-500">Overall readiness</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-ink-600">{statusText}</span>
              <span className="font-display text-xl text-amber-400 tabular-nums">{demo.total}%</span>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="space-y-2.5">
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-mono text-blue-400 flex-shrink-0 mt-0.5">U</div>
            <div className="text-[13px] text-ink-300 px-3 py-2 rounded-xl flex-1"
              style={{ background: 'rgba(85,144,232,0.07)', border: '1px solid rgba(85,144,232,0.12)' }}>
              I want to build an app like Airbnb for co-working spaces
            </div>
          </div>
          {demo.showMsg && (
            <div className="flex gap-2.5 fade-up">
              <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] font-mono text-amber-400 flex-shrink-0 mt-0.5">S</div>
              <div className="text-[13px] text-ink-400 leading-relaxed flex-1">
                <strong className="text-ink-200">Before I touch any model</strong> — who is the primary user?
                The person looking for a desk, or the office owner listing their space?
                Your entire data model changes based on that answer.
              </div>
            </div>
          )}
          {demo.showChallenge && (
            <div className="ml-8 text-[12px] text-ink-500 px-3 py-2.5 rounded-lg leading-relaxed fade-up"
              style={{ background: 'rgba(224,85,85,0.05)', border: '1px solid rgba(224,85,85,0.12)' }}>
              <span className="text-[10px] font-mono text-[#e05555] mr-1.5">⚡ CHALLENGE —</span>
              Airbnb took 10 years and $6B to build marketplace trust. What's your plan for the chicken-and-egg problem on day one?
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 text-[13px] text-ink-700 px-3 py-2 rounded-lg border border-ink-800/50">
              {demo.done
                ? <span className="text-emerald-500">✓ Masterplan generated — 68% fewer tokens used</span>
                : 'Both — owners list spaces, workers book them…'}
            </div>
            <button className="px-3 py-2 rounded-lg text-[12px] font-semibold text-[#0a0908]"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #e85d26)' }}>↑</button>
          </div>
        </div>
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { createSession, isLoading, sessionError, sessionHistory, resumeSession } = useSessionStore()

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
    { icon: '⚖️', title: 'Debate Engine', desc: 'Proposes an approach, then argues against its own proposal. Forces you to genuinely defend your choices.', tag: 'Core', tc: '#f59e0b' },
    { icon: '📊', title: 'Evaluation Bar', desc: 'Real-time visual score across 5 dimensions. Refuses to generate output until context is sufficient.', tag: 'Core', tc: '#5590e8' },
    { icon: '🔍', title: 'Assumption Tracker', desc: 'Every hidden assumption surfaced explicitly. Correct one and the whole recommendation recalibrates.', tag: 'Core', tc: '#e85d26' },
    { icon: '🧠', title: 'Cross-session Memory', desc: 'Remembers your stack, team size, and past decisions. References them in future projects automatically.', tag: 'Pro', tc: '#34d399' },
    { icon: '🗺️', title: 'Architecture Diagram', desc: 'Auto-generates a system diagram — components, communication patterns, scaling risks.', tag: 'Pro', tc: '#f59e0b' },
    { icon: '⚠️', title: '"What Could Go Wrong"', desc: 'Top 5 failure modes at scale, each with a specific mitigation. The final senior-engineer review.', tag: 'Pro', tc: '#e05555' },
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
          <span className="italic text-amber-400">argues back</span>
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
          {['3 phases of interrogation', 'Live 5-dimension eval bar', 'Full architecture masterplan'].map((t) => (
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
              {CLERK_ENABLED && <SyncNudge />}
            </div>
            <div className="flex flex-col gap-1.5">
              {sessionHistory.slice(0, 4).map((s) => (
                <button key={s.id} onClick={() => resumeSession(s.id)} disabled={isLoading}
                  className="group text-left px-4 py-3 rounded-xl border border-ink-800/40 hover:border-ink-700/60 hover:bg-ink-900/30 transition-all flex items-center gap-3">
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
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Ticker ───────────────────────────────────────────────────────────── */}
      <div className="border-y border-ink-800/40 py-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="ticker-track flex gap-0">
          {[...Array(2)].flatMap(() =>
            ['Debates your approach', 'Stress-tests at scale', 'Saves API credits', 'Generates architecture', 'Surfaces assumptions', 'Exports to PRD', 'Finds failure modes', 'Challenges your decisions'].map((t) => (
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
                'Structured debate → expert context → precise output first time',
                'One optimized call to the right model',
                'Architecture stress-tested against scale and failure modes',
                'Every assumption surfaced and confirmed before a line is written',
                'Full decision log exported as a PRD',
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
            Everything a staff engineer does<br />
            before saying <em className="text-amber-400 not-italic">"let's start coding."</em>
          </SectionHeading>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title}
                className="group rounded-2xl p-5 border border-ink-800/50 hover:border-ink-700/70 transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(255,255,255,0.015)' }}>
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-[14px] font-semibold text-ink-200 mb-2">{f.title}</h3>
                <p className="text-[13px] text-ink-600 leading-relaxed mb-3">{f.desc}</p>
                <span className="inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded-full"
                  style={{ color: f.tc, background: `${f.tc}12`, border: `1px solid ${f.tc}25` }}>
                  {f.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <SectionBadge>Pricing</SectionBadge>
          <SectionHeading>Save more than you spend.</SectionHeading>
          <p className="text-ink-500 mb-10" style={{ fontSize: '15px' }}>One good session pays for itself in API credits saved.</p>

          <div className="grid sm:grid-cols-2 gap-4 text-left mb-4">
            {/* Free */}
            <div className="rounded-2xl p-6 border border-ink-800/50" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[12px] font-mono font-semibold text-ink-600 uppercase tracking-wider mb-3">Free</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-display text-4xl font-bold text-ink-100">₹0</span>
                <span className="text-ink-600 mb-1 text-[14px]">/month</span>
              </div>
              <p className="text-[13px] text-ink-600 mb-5">For exploring the idea</p>
              <div className="space-y-2 mb-6">
                {['3 architect sessions/month', 'Evaluation bar + debate engine', 'Basic masterplan output'].map(f => (
                  <div key={f} className="flex gap-2 text-[13px] text-ink-400">
                    <span className="text-emerald-500">✓</span>{f}
                  </div>
                ))}
                <div className="flex gap-2 text-[13px] text-ink-700">
                  <span>✗</span>Memory, diagrams, PRD export
                </div>
              </div>
              <button className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-ink-300 border border-ink-700 hover:border-ink-600 transition-all">
                Start free
              </button>
            </div>

            {/* Pro */}
            <div className="rounded-2xl p-6 border relative overflow-hidden"
              style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(232,93,38,0.02) 100%)' }}>
              <div className="absolute top-3 right-3 text-[10px] font-mono text-amber-400/70 border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 rounded-full">
                Most popular
              </div>
              <p className="text-[12px] font-mono font-semibold text-amber-400/80 uppercase tracking-wider mb-3">Pro</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-display text-4xl font-bold text-ink-100">₹999</span>
                <span className="text-ink-600 mb-1 text-[14px]">/month</span>
              </div>
              <p className="text-[13px] text-ink-600 mb-5">For founders and solo devs</p>
              <div className="space-y-2 mb-6">
                {['Unlimited architect sessions', 'Cross-session memory', 'Architecture diagrams', 'Cost estimator + risk report', 'Export to PRD', "Devil's advocate mode"].map(f => (
                  <div key={f} className="flex gap-2 text-[13px] text-ink-300">
                    <span className="text-emerald-400">✓</span>{f}
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#e85d26)', color: '#080809', boxShadow: '0 0 24px rgba(245,158,11,0.2)' }}>
                Get Pro — ₹999/mo
              </button>
            </div>
          </div>
          <p className="text-[12px] text-ink-700">Team plan at ₹3,499/month for up to 5 seats. Enterprise? <a href="#waitlist" className="text-amber-500/60 hover:text-amber-400 transition-colors">Talk to us.</a></p>
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
