import { useState, useEffect, useRef, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-ignore
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react'
import { useSessionStore } from '../store/sessionStore'
import type { AgentReport, Assumption } from '../store/sessionStore'
import { EvalBar } from './EvalBar/EvalBar'
import { PitchDeckView } from './PitchDeckView'
import { DebateView } from './DebateView'
import { FollowUpEmailCapture } from './FollowUpEmailCapture'
import { CLERK_ENABLED } from '../lib/auth'

function SessionAuthButton() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!CLERK_ENABLED || !isLoaded) return null
  if (isSignedIn) return (
    <div className="flex-shrink-0">
      <UserButton afterSignOutUrl="/" />
    </div>
  )
  return (
    <button
      onClick={() => openSignIn()}
      className="flex-shrink-0 text-[11px] font-mono text-amber-400/50 hover:text-amber-400 border border-amber-500/15 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-all"
    >
      Sign in
    </button>
  )
}

function SaveNudge() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!CLERK_ENABLED || !isLoaded || isSignedIn) return null
  return (
    <button
      onClick={() => openSignIn()}
      className="w-full text-center text-[11px] font-mono text-amber-400/50 hover:text-amber-400 border border-amber-500/10 hover:border-amber-500/25 bg-amber-500/[0.03] px-4 py-2 rounded-xl transition-all"
    >
      ⚠ This session isn't saved to an account — sign in to keep your work across devices →
    </button>
  )
}

const PHASE_STEPS = [
  { key: 'intake',      label: 'Intake',      color: '#8a8578' },
  { key: 'debate',      label: 'Debate',      color: '#f59e0b' },
  { key: 'stress_test', label: 'Stress Test', color: '#e85d26' },
  { key: 'masterplan',  label: 'Masterplan',  color: '#34d399' },
]

const PHASE_COLOR: Record<string, string> = {
  intake: '#8a8578', debate: '#f59e0b', stress_test: '#e85d26', masterplan: '#34d399',
}

const TOTAL_AGENTS = 5

const STATUS_CYCLE: Record<Assumption['status'], Assumption['status']> = {
  unknown: 'validated',
  validated: 'disproved',
  disproved: 'unknown',
}
const STATUS_STYLE: Record<Assumption['status'], { chip: string; dot: string; label: string }> = {
  unknown:   { chip: 'text-ink-500 bg-ink-900/60 border-ink-800/50 hover:border-ink-700/70',      dot: 'bg-amber-400/40',   label: '' },
  validated: { chip: 'text-emerald-400/80 bg-emerald-500/8 border-emerald-500/25 hover:border-emerald-500/50', dot: 'bg-emerald-400/80', label: '✓' },
  disproved: { chip: 'text-red-400/70 bg-red-500/8 border-red-500/20 hover:border-red-500/40',    dot: 'bg-red-400/70',     label: '✗' },
}

function AssumptionsList({ assumptions }: { assumptions: Assumption[] }) {
  const updateAssumptionStatus = useSessionStore((s) => s.updateAssumptionStatus)
  const [expanded, setExpanded] = useState(true)
  const prevCount = useRef(assumptions.length)

  useEffect(() => {
    if (assumptions.length > prevCount.current) setExpanded(true)
    prevCount.current = assumptions.length
  }, [assumptions.length])

  const validated = assumptions.filter(a => a.status === 'validated').length
  const disproved = assumptions.filter(a => a.status === 'disproved').length

  return (
    <div className="rounded-xl border border-ink-800/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-ink-900/40 transition-colors"
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-600">Assumptions</span>
        <span className="text-[10px] font-mono text-ink-700 bg-ink-800/80 px-1.5 py-0.5 rounded-full tabular-nums">
          {assumptions.length}
        </span>
        {validated > 0 && (
          <span className="text-[10px] font-mono text-emerald-400/70 bg-emerald-500/8 border border-emerald-500/20 px-1.5 py-0.5 rounded-full tabular-nums">
            ✓ {validated}
          </span>
        )}
        {disproved > 0 && (
          <span className="text-[10px] font-mono text-red-400/60 bg-red-500/8 border border-red-500/15 px-1.5 py-0.5 rounded-full tabular-nums">
            ✗ {disproved}
          </span>
        )}
        <svg className={`w-3 h-3 text-ink-700 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1.5 flex flex-wrap gap-1.5 border-t border-ink-800/50">
          {assumptions.map((assumption, i) => {
            const s = STATUS_STYLE[assumption.status]
            return (
              <button
                key={i}
                title="Click to mark validated / disproved"
                onClick={() => updateAssumptionStatus(i, STATUS_CYCLE[assumption.status])}
                className={`inline-flex items-center gap-1.5 text-[11px] border rounded-full px-3 py-1 leading-none transition-all duration-200 cursor-pointer ${s.chip}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 text-[9px] flex items-center justify-center ${!s.label ? s.dot : ''}`}
                  style={s.label ? {} : undefined}>
                  {s.label && <span className={`text-[10px] leading-none ${assumption.status === 'validated' ? 'text-emerald-400' : 'text-red-400'}`}>{s.label}</span>}
                  {!s.label && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
                </span>
                {assumption.text}
              </button>
            )
          })}
          <p className="w-full text-[10px] font-mono text-ink-800 mt-1">Click any assumption to mark it validated ✓ or disproved ✗</p>
        </div>
      )}
    </div>
  )
}

function AgentReportCard({ report, isNew }: { report: AgentReport; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${isNew ? 'fade-up' : ''}`}
      style={{ borderColor: `${report.color}25`, background: `${report.color}06` }}
    >
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg flex-shrink-0">{report.icon}</span>
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider flex-1 text-left"
          style={{ color: report.color }}>
          {report.title}
        </span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: `${report.color}60` }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: `${report.color}15` }}>
          <div className="prose prose-invert prose-sm max-w-none
            prose-p:text-ink-400 prose-p:leading-relaxed prose-p:my-1.5
            prose-li:text-ink-400 prose-li:my-0.5
            prose-strong:text-ink-200 prose-ul:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentReportSkeleton() {
  return (
    <div className="rounded-xl border border-ink-800/40 px-4 py-3 flex items-center gap-3">
      <div className="w-4 h-4 rounded-full border-2 border-ink-700/60 border-t-transparent animate-spin flex-shrink-0" />
      <span className="text-[11px] font-mono text-ink-800">Analyzing...</span>
    </div>
  )
}

function DevilsAdvocateCard({ report }: { report: AgentReport }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="rounded-2xl border overflow-hidden fade-up"
      style={{ borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.025)' }}>
      <button
        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.01] transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xl flex-shrink-0">💀</span>
        <div className="flex-1 text-left">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-red-400/80">
            Devil's Advocate
          </div>
          <div className="text-[11px] font-mono text-red-600/50 mt-0.5">
            5 reasons this fails
          </div>
        </div>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: 'rgba(239,68,68,0.35)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: 'rgba(239,68,68,0.10)' }}>
          <div className="prose prose-invert prose-sm max-w-none
            prose-p:text-red-300/65 prose-li:text-red-300/65 prose-strong:text-red-200/80
            prose-ol:my-2 prose-ol:space-y-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

const BILLING_ENABLED = !!import.meta.env.VITE_RAZORPAY_KEY_ID

function PaywallModal() {
  const { session, createCheckout, paymentRequired, devUnlock } = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)

  if (!paymentRequired || !session) return null

  const handlePay = async () => {
    setLoading(true)
    const url = await createCheckout()
    if (url) {
      window.location.href = url
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-md w-full rounded-2xl border overflow-hidden fade-up"
        style={{ borderColor: 'rgba(52,211,153,0.2)', background: 'rgba(10,10,11,0.97)' }}>
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(52,211,153,0.1)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-400/70">Analysis ready</span>
          </div>
          <h2 className="text-[22px] font-display font-bold text-ink-50 leading-tight mb-2">
            Unlock your masterplan
          </h2>
          <p className="text-[13px] text-ink-500 leading-relaxed">
            Socra has finished interrogating your idea. Your full analysis is ready to generate.
          </p>
        </div>

        {/* What you get */}
        <div className="px-7 py-5 flex flex-col gap-2.5">
          {[
            { icon: '🏛', label: 'The Council — 5 AI advisors', sub: 'The Banker, Oracle, Challenger, Builder, Skeptic' },
            { icon: '📄', label: "Chairman's Masterplan", sub: '2,000+ word strategic & technical verdict' },
            { icon: '💡', label: 'Devil\'s advocate', sub: 'The 5 reasons this fails' },
            { icon: '🎤', label: 'Investor pitch deck', sub: '10-slide narrative, exportable HTML' },
            { icon: '⚔', label: 'Bull vs Bear debate', sub: '3-round AI debate on your idea' },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[13px] text-ink-200 font-medium">{label}</div>
                <div className="text-[11px] text-ink-600 font-mono mt-0.5">{sub}</div>
              </div>
              <div className="ml-auto flex-shrink-0 mt-1">
                <div className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-7 pb-7 pt-2">
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-display font-bold text-[15px] transition-all duration-200 disabled:opacity-50"
            style={{
              background: loading ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #34d399, #10b981)',
              color: '#08070a',
              boxShadow: loading ? 'none' : '0 4px 24px rgba(52,211,153,0.25)',
            }}
          >
            {loading ? 'Redirecting to payment…' : 'Unlock for ₹499 →'}
          </button>
          {!BILLING_ENABLED && (
            <button
              onClick={async () => { setDevLoading(true); await devUnlock(); setDevLoading(false) }}
              disabled={devLoading}
              className="w-full py-2.5 rounded-xl text-[12px] font-mono transition-all duration-200 disabled:opacity-50 mt-2"
              style={{ background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.2)', color: 'rgba(255,200,0,0.7)' }}
            >
              {devLoading ? 'Unlocking…' : '[DEV] Skip payment & unlock'}
            </button>
          )}
          <p className="text-center text-[11px] font-mono text-ink-700 mt-3">
            One-time payment · Secure checkout via Stripe · No subscription
          </p>
        </div>
      </div>
    </div>
  )
}

export function SessionPage() {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [deckLoading, setDeckLoading] = useState(false)
  const [showDeck, setShowDeck] = useState(false)
  const [debateLoading, setDebateLoading] = useState(false)
  const [showDebate, setShowDebate] = useState(false)
  const [view, setView] = useState<'chat' | 'council' | 'masterplan'>('chat')
  const {
    session, isSending, streamingMessage, currentChoices,
    currentAgentReports, isAnalyzing, isResearching, isUnlocking,
    streamError, savedFlash, lastSentMessage,
    sendMessage, clearSession, generatePitchDeck, generateDebate,
  } = useSessionStore()

  const [cardCopied, setCardCopied] = useState(false)

  const handleShare = () => {
    const url = `${window.location.origin}/share/${session?.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShareCard = () => {
    const url = `${window.location.origin}/card/${session?.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCardCopied(true)
      setTimeout(() => setCardCopied(false), 2000)
    })
  }
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.conversation_history.length, isSending, currentAgentReports.length])

  // Auto-navigate to council view when masterplan first arrives
  useEffect(() => {
    if (session?.masterplan) setView('council')
  }, [!!session?.masterplan])

  if (!session) return null

  const { scores, total_score, phase, explanations, conversation_history, masterplan, refusal, assumptions, agent_reports, pitch_deck, debate } = session

  const phaseColor = PHASE_COLOR[phase] || '#8a8578'
  const phaseIdx = PHASE_STEPS.findIndex(p => p.key === phase)

  // Prefer stored agent_reports (from DB) over in-progress streaming ones
  const displayReports = agent_reports?.length ? agent_reports : currentAgentReports
  const specialistReports = displayReports.filter(r => r.key !== 'devils_advocate')
  const devilReport = displayReports.find(r => r.key === 'devils_advocate')
  const pendingAgentCount = isAnalyzing ? Math.max(0, TOTAL_AGENTS - specialistReports.length) : 0

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return
    setInput('')
    await sendMessage(trimmed)
    textareaRef.current?.focus()
  }

  const ideaSlug = session.initial_idea.length > 52
    ? session.initial_idea.slice(0, 52) + '…'
    : session.initial_idea

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-1000"
      style={{
        background: '#080809',
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${phaseColor}08 0%, transparent 55%)`,
      }}>

      {/* Paywall modal — shown when billing is enabled and masterplan is locked */}
      <PaywallModal />

      {/* Unlock in-progress overlay */}
      {isUnlocking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(8,8,9,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-400/60 border-t-emerald-400 animate-spin" />
            <span className="text-[13px] font-mono text-emerald-400/80">The Council is deliberating…</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-800/50 px-6 relative overflow-hidden"
        style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)' }}>

        <div className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-1000"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${phaseColor}80 30%, ${phaseColor}80 70%, transparent 100%)` }} />

        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 pt-3 pb-2.5">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-600">Socra</span>
            </div>
            <div className="w-px h-3.5 bg-ink-800 flex-shrink-0" />
            <p className="text-[12px] text-ink-600 truncate flex-1 leading-none">{ideaSlug}</p>
            <button
              onClick={clearSession}
              className="flex-shrink-0 text-[11px] font-mono text-ink-700 hover:text-ink-400 border border-ink-800/60 hover:border-ink-700 px-2.5 py-1 rounded-lg transition-all"
            >
              ← new
            </button>
            <SessionAuthButton />
          </div>

          {/* Phase stepper */}
          <div className="flex items-center pb-3">
            {PHASE_STEPS.map((p, i) => {
              const isActive = i === phaseIdx
              const isDone = i < phaseIdx
              return (
                <Fragment key={p.key}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-700"
                      style={{
                        background: isActive ? p.color : isDone ? `${p.color}50` : 'rgba(255,255,255,0.08)',
                        boxShadow: isActive ? `0 0 8px ${p.color}` : 'none',
                      }} />
                    <span className="text-[10px] font-mono tracking-wider transition-colors duration-500"
                      style={{
                        color: isActive ? p.color : isDone ? `${p.color}55` : 'rgba(255,255,255,0.15)',
                      }}>
                      {p.label}
                    </span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <div className="h-px flex-shrink-0 w-8 mx-2.5 transition-all duration-700"
                      style={{ background: isDone ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)' }} />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── VIEW: COUNCIL ─────────────────────────────────────── */}
      {view === 'council' && masterplan && (
        <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-700 mb-1">The Council</div>
              <div className="text-[18px] font-display font-bold text-ink-100">Specialist Analysis</div>
            </div>
            <button
              onClick={() => setView('masterplan')}
              className="px-5 py-2.5 rounded-xl font-mono text-[12px] font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#08070a' }}
            >
              Masterplan →
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {specialistReports.map((report) => (
              <AgentReportCard key={report.key} report={report} isNew={false} />
            ))}
          </div>

          {devilReport && <DevilsAdvocateCard report={devilReport} />}

          <button
            onClick={() => setView('masterplan')}
            className="w-full py-3.5 rounded-xl font-mono text-[12px] tracking-[0.1em] uppercase transition-all"
            style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.7)' }}
          >
            Continue to Masterplan →
          </button>

          <FollowUpEmailCapture sessionId={session.id} />
        </div>
      )}

      {/* ── VIEW: MASTERPLAN ───────────────────────────────────── */}
      {view === 'masterplan' && masterplan && (
        <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setView('council')} className="text-[10px] font-mono text-ink-700 hover:text-ink-400 mb-1 transition-colors">← Back to Council</button>
              <div className="text-[18px] font-display font-bold text-ink-100">Chairman's Masterplan</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleShare} className="text-[10px] font-mono text-ink-700 hover:text-ink-400 border border-ink-800/50 px-2.5 py-1 rounded-lg transition-all">{copied ? '✓ Copied' : '↗ Share'}</button>
              <button onClick={handleShareCard} className="text-[10px] font-mono text-ink-700 hover:text-amber-400 border border-ink-800/50 px-2.5 py-1 rounded-lg transition-all">{cardCopied ? '✓ Copied' : '🃏 Card'}</button>
              <a href={`/?compare=${session.id}`} className="text-[10px] font-mono text-ink-700 hover:text-ink-400 border border-ink-800/50 px-2.5 py-1 rounded-lg transition-all">↔ Compare</a>
            </div>
          </div>

          {/* Pitch deck CTA */}
          <div className="rounded-xl p-5 flex items-center justify-between gap-4"
            style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
            <div>
              <div className="text-[12px] font-mono text-amber-400/80 uppercase tracking-[0.1em] mb-1">Investor Pitch Deck</div>
              <div className="text-[12px] text-ink-500">10-slide narrative — exportable as HTML</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  const slug = session.initial_idea.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                  const blob = new Blob([masterplan], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = `socra-${slug}.md`; a.click()
                  URL.revokeObjectURL(url)
                }}
                className="px-3 py-2 rounded-lg text-[11px] font-mono transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
              >↓ .md</button>
              <button
                onClick={async () => {
                  if (pitch_deck) { setShowDeck(v => !v); return }
                  setDeckLoading(true); await generatePitchDeck(); setDeckLoading(false); setShowDeck(true)
                }}
                disabled={deckLoading}
                className="px-4 py-2 rounded-lg text-[12px] font-mono font-semibold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#08070a' }}
              >{deckLoading ? 'Generating…' : pitch_deck ? (showDeck ? '▲ Hide Deck' : '▼ View Deck') : '⬡ Generate Pitch Deck'}</button>
            </div>
          </div>

          {showDeck && pitch_deck && (
            <PitchDeckView deck={pitch_deck} idea={session.initial_idea} sessionId={session.id} devilReport={devilReport} />
          )}

          {/* Masterplan body */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'rgba(52,211,153,0.15)', background: 'rgba(52,211,153,0.02)' }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'rgba(52,211,153,0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-emerald-400/70">Full Strategic Analysis</span>
            </div>
            <div className="px-7 py-7 prose prose-invert max-w-none
              prose-headings:font-display prose-headings:tracking-tight
              prose-h1:text-[20px] prose-h1:text-ink-50 prose-h1:font-bold prose-h1:mb-3
              prose-h2:text-[11px] prose-h2:font-semibold prose-h2:uppercase prose-h2:tracking-[0.14em] prose-h2:text-emerald-400/70 prose-h2:mt-9 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-emerald-500/15
              prose-h3:text-[14px] prose-h3:text-ink-200 prose-h3:font-semibold prose-h3:mt-5 prose-h3:mb-2
              prose-p:text-ink-400 prose-p:leading-7 prose-p:text-[14px] prose-p:my-2
              prose-li:text-ink-400 prose-li:text-[14px] prose-li:leading-6 prose-li:my-1
              prose-ul:my-2 prose-ol:my-2 prose-strong:text-ink-200 prose-strong:font-semibold
              prose-code:text-amber-300 prose-code:bg-amber-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-ink-900/80 prose-pre:border prose-pre:border-ink-800/60 prose-pre:rounded-xl prose-pre:p-4
              prose-table:text-[13px] prose-table:w-full prose-thead:border-b prose-thead:border-ink-700/50
              prose-th:text-ink-500 prose-th:font-mono prose-th:text-[10px] prose-th:uppercase prose-th:tracking-wider prose-th:py-2.5 prose-th:px-4 prose-th:font-medium prose-th:bg-ink-900/40
              prose-td:text-ink-400 prose-td:py-2.5 prose-td:px-4 prose-td:border-b prose-td:border-ink-800/40 prose-td:align-top prose-td:text-[13px] prose-td:leading-relaxed
              prose-hr:border-ink-800/50 prose-hr:my-6
              prose-blockquote:border-l-2 prose-blockquote:border-amber-500/30 prose-blockquote:text-ink-500 prose-blockquote:pl-4 prose-blockquote:not-italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{masterplan}</ReactMarkdown>
            </div>
          </div>

          <button
            onClick={async () => {
              if (debate) { setShowDebate(v => !v); return }
              setDebateLoading(true); await generateDebate(); setDebateLoading(false); setShowDebate(true)
            }}
            disabled={debateLoading}
            className="text-[11px] font-mono text-indigo-400/50 hover:text-indigo-300 border border-indigo-500/15 hover:border-indigo-500/40 px-3 py-2 rounded-lg transition-all self-start disabled:opacity-40"
          >{debateLoading ? '…' : debate ? (showDebate ? '▲ Hide Debate' : '▼ Bull vs Bear Debate') : '⚔ Generate Bull vs Bear Debate'}</button>

          {showDebate && debate && <DebateView debate={debate} />}

          <div className="h-6" />
        </div>
      )}

      {/* ── VIEW: CHAT (default) ───────────────────────────────── */}
      {view === 'chat' && <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Eval bar */}
        <EvalBar scores={scores} totalScore={total_score} phase={phase} explanations={explanations} />

        {/* Save nudge for anonymous users */}
        <SaveNudge />

        {/* Assumptions */}
        {assumptions.length > 0 && <AssumptionsList assumptions={assumptions} />}

        {/* Web research indicator */}
        {isResearching && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px] font-mono text-blue-400/80 animate-pulse">
              Searching the web...
            </span>
          </div>
        )}

        {/* Council streaming indicator (agents loading, no masterplan yet) */}
        {!masterplan && (specialistReports.length > 0 || isAnalyzing) && (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(245,158,11,0.6)' }} />
            <span className="text-[12px] font-mono text-amber-400/70">
              The Council is analysing your idea… {specialistReports.length}/{TOTAL_AGENTS} advisors done
            </span>
          </div>
        )}

        {/* Conversation */}
        <div className="flex flex-col gap-6">
          {conversation_history.filter(msg => (msg.content?.replace(/[*#\-_>\s]/g, '') ?? '').length > 5).map((msg, i) => (
            <div key={i} className={`flex gap-4 fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #e85d26)',
                      color: '#08070a',
                      boxShadow: '0 2px 10px rgba(245,158,11,0.22)',
                    }}>
                    S
                  </div>
                </div>
              )}
              <div className={msg.role === 'user'
                ? 'max-w-[75%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed text-ink-200'
                : 'flex-1 min-w-0 text-[14px] leading-relaxed'
              }
                style={msg.role === 'user' ? {
                  background: 'rgba(255,255,255,0.055)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                } : undefined}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert max-w-none text-ink-300
                    prose-headings:text-ink-100 prose-headings:font-display prose-headings:tracking-tight prose-headings:mt-5 prose-headings:mb-2
                    prose-strong:text-ink-100 prose-strong:font-semibold
                    prose-p:text-ink-300 prose-p:leading-relaxed prose-p:my-2
                    prose-li:text-ink-300 prose-li:my-0.5
                    prose-code:text-amber-300 prose-code:text-[13px] prose-code:bg-ink-900/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-blockquote:border-amber-500/30 prose-blockquote:text-ink-500"
                    style={{ fontSize: '14px' }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-ink-400"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    U
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming — conversation or synthesis */}
          {isSending && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #e85d26)',
                    color: '#08070a',
                    boxShadow: streamingMessage ? '0 2px 10px rgba(245,158,11,0.22)' : '0 2px 16px rgba(245,158,11,0.4)',
                  }}>
                  S
                </div>
              </div>
              {streamingMessage ? (
                <div className="flex-1 min-w-0">
                  <div className="prose prose-invert max-w-none text-ink-300
                    prose-strong:text-ink-100 prose-p:text-ink-300 prose-p:leading-relaxed prose-p:my-2
                    prose-li:text-ink-300 prose-headings:text-ink-100"
                    style={{ fontSize: '14px' }}>
                    <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-[3px] h-4 bg-amber-400/60 animate-pulse rounded-sm ml-0.5 align-middle" />
                </div>
              ) : isAnalyzing ? (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[12px] text-ink-600 font-mono">The Chairman deliberates</span>
                  {[0, 120, 240].map((delay) => (
                    <div key={delay} className="w-1 h-1 rounded-full bg-emerald-500/60 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 pt-2">
                  {[0, 120, 240].map((delay) => (
                    <div key={delay} className="w-1.5 h-1.5 rounded-full bg-ink-700 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fallback: show Socra avatar + prompt when LLM returned empty Part 1 but generated choices */}
          {!isSending && currentChoices.length > 0 && !masterplan &&
            conversation_history.length > 0 &&
            conversation_history.filter(m => (m.content?.replace(/[*#\-_>\s]/g, '') ?? '').length > 5).slice(-1)[0]?.role === 'user' && (
            <div className="flex gap-4 fade-up justify-start">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #e85d26)', color: '#08070a', boxShadow: '0 2px 10px rgba(245,158,11,0.22)' }}>
                  S
                </div>
              </div>
              <div className="rounded-2xl px-4 py-3 max-w-[82%] text-[14px] text-ink-400 italic">
                Pick one of the suggested answers below, or type your own response.
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested answer chips — stay visible while user types, clear only on send */}
        {currentChoices.length > 0 && !isSending && !masterplan && (
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Suggested answers — click to pre-fill, then edit &amp; send</span>
            <div className="flex flex-wrap gap-2">
              {currentChoices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(choice); setTimeout(() => document.querySelector('textarea')?.focus(), 50) }}
                  className="text-[13px] text-ink-400 border border-ink-800/70 hover:border-amber-500/40 hover:text-ink-100 hover:bg-amber-500/5 px-4 py-2 rounded-full transition-all duration-200 text-left"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Saved flash */}
        {savedFlash && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-500/60 fade-up">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Saved
          </div>
        )}

        {/* Stream error + retry */}
        {streamError && !isSending && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-mono"
            style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <span className="text-red-400/80">
              {streamError === 'timeout' ? 'Response timed out — the server took too long.' : 'Connection dropped.'}
            </span>
            {lastSentMessage && (
              <button
                onClick={() => { useSessionStore.getState().sendMessage(lastSentMessage) }}
                className="ml-auto px-3 py-1 rounded-lg text-[11px] font-mono text-red-300/80 hover:text-red-200 transition-colors"
                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                Retry →
              </button>
            )}
          </div>
        )}

        {/* Progress hint toward masterplan */}
        {!masterplan && total_score > 0 && total_score < 0.85 && !isSending && (
          <div className="text-[10px] font-mono text-ink-700 text-center">
            {total_score < 0.4
              ? `${Math.round((0.4 - total_score) / 0.05)} more specific answers needed to unlock analysis`
              : total_score < 0.7
              ? 'Good progress — keep adding detail to each dimension'
              : 'Almost there — one or two more strong answers'}
          </div>
        )}

        {/* Refusal notice */}
        {refusal && (
          <div className="px-4 py-3 rounded-xl text-[12px] text-ink-600 font-mono leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {refusal}
          </div>
        )}

        {/* Input — always visible; switches to follow-up mode after masterplan */}
        <div className="sticky bottom-6">
          <div className="relative group">
            <div className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: masterplan
                  ? 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(232,93,38,0.1))',
                filter: 'blur(1px)',
              }} />
            <div className="relative rounded-2xl overflow-hidden border transition-colors duration-300"
              style={{
                background: 'rgba(13,12,11,0.97)',
                backdropFilter: 'blur(12px)',
                borderColor: masterplan ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.1)',
              }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={masterplan ? 'Ask a follow-up question…' : 'Reply to Socra…'}
                rows={3}
                disabled={isSending}
                className="w-full bg-transparent px-5 pt-4 pb-3 text-[14px] text-ink-100 placeholder-ink-700 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSend() }}
              />
              <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800/50">
                {masterplan ? (
                  <span className="text-[11px] font-mono" style={{ color: 'rgba(52,211,153,0.35)' }}>
                    Follow-up mode
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-800 font-mono">⌘↵ to send</span>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-25"
                  style={{
                    background: input.trim() && !isSending
                      ? masterplan
                        ? 'linear-gradient(135deg, #34d399, #10b981)'
                        : 'linear-gradient(135deg, #f59e0b, #e85d26)'
                      : 'rgba(40,38,34,0.8)',
                    boxShadow: input.trim() && !isSending
                      ? masterplan ? '0 0 16px rgba(52,211,153,0.2)' : '0 0 16px rgba(245,158,11,0.2)'
                      : 'none',
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                    stroke={input.trim() && !isSending ? '#08070a' : '#4a4840'} strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>}
    </div>
  )
}
