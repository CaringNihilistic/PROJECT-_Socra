import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import axios from 'axios'
import type { SessionData, AgentReport, ScoreExplanation } from '../store/sessionStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function ScoreRow({ exp }: { exp: ScoreExplanation }) {
  const pct = Math.round(exp.score * 100)
  const color = exp.score >= 0.7 ? '#34d399' : exp.score >= 0.4 ? '#f59e0b' : '#e85d26'
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-mono text-ink-600 w-36 flex-shrink-0">{exp.label}</span>
      <div className="flex-1 h-1 rounded-full bg-ink-800/60 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}40` }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

function SharedAgentCard({ report }: { report: AgentReport }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${report.color}25`, background: `${report.color}06` }}>
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg flex-shrink-0">{report.icon}</span>
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider flex-1 text-left" style={{ color: report.color }}>
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
          <div className="prose prose-invert prose-sm max-w-none prose-p:text-ink-400 prose-li:text-ink-400 prose-strong:text-ink-200 prose-ul:my-1">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export function SharePage({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    axios.get<SessionData>(`${API_URL}/sessions/${sessionId}`)
      .then(({ data }) => setSession(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
          <span className="text-[13px] font-mono text-ink-700">Loading masterplan…</span>
        </div>
      </div>
    )
  }

  if (notFound || !session || !session.masterplan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#080809' }}>
        <p className="text-ink-600 font-mono text-sm">Masterplan not found or not yet generated.</p>
        <a href="/" className="text-[13px] font-mono text-amber-400 hover:text-amber-300 transition-colors">
          ← Analyze your own idea
        </a>
      </div>
    )
  }

  const totalPct = Math.round(session.total_score * 100)

  return (
    <div className="min-h-screen" style={{ background: '#080809', backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.06) 0%, transparent 55%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-800/50"
        style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.6) 30%, rgba(52,211,153,0.6) 70%, transparent 100%)' }} />
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-600">Socra</span>
            <span className="text-ink-800 mx-1">/</span>
            <span className="text-[11px] font-mono text-emerald-500/70 uppercase tracking-[0.1em]">Masterplan</span>
          </div>
          <a
            href="/"
            className="text-[11px] font-mono text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition-all"
          >
            Analyze your idea →
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Idea title */}
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-700 mb-2">Project idea</p>
          <h1 className="text-[22px] font-display font-semibold text-ink-100 leading-snug">
            {session.initial_idea}
          </h1>
        </div>

        {/* Score summary */}
        <div className="rounded-2xl border border-ink-800/50 px-5 py-5 flex flex-col gap-4"
          style={{ background: 'rgba(13,12,11,0.6)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Analysis score</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
              <span className="text-[13px] font-mono font-semibold text-emerald-400">{totalPct}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {session.explanations?.map((exp) => (
              <ScoreRow key={exp.dimension} exp={exp} />
            ))}
          </div>
        </div>

        {/* Agent reports */}
        {session.agent_reports?.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700 mb-3">Specialist analysis</p>
            <div className="flex flex-col gap-2">
              {session.agent_reports.map((report) => (
                <SharedAgentCard key={report.key} report={report} />
              ))}
            </div>
          </div>
        )}

        {/* Masterplan */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'rgba(52,211,153,0.15)', background: 'rgba(52,211,153,0.02)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5 border-b"
            style={{ borderColor: 'rgba(52,211,153,0.12)', background: 'rgba(52,211,153,0.03)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-emerald-400/80">
              Architecture masterplan
            </span>
          </div>
          <div className="px-5 py-5 prose prose-invert prose-sm max-w-none text-ink-400
            prose-headings:text-ink-100 prose-headings:font-display prose-headings:tracking-tight
            prose-strong:text-ink-200 prose-code:text-amber-300 prose-code:bg-ink-900 prose-code:px-1 prose-code:rounded
            prose-li:text-ink-400 prose-p:text-ink-400 prose-table:text-ink-400
            prose-th:text-ink-300 prose-th:font-mono prose-th:text-[11px] prose-th:uppercase prose-th:tracking-wider">
            <ReactMarkdown>{session.masterplan}</ReactMarkdown>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="rounded-2xl border border-ink-800/40 px-6 py-6 text-center flex flex-col items-center gap-3"
          style={{ background: 'rgba(13,12,11,0.4)' }}>
          <p className="text-[13px] text-ink-500">
            Want Socra to stress-test your own idea?
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-mono font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #e85d26)',
              color: '#08070a',
              boxShadow: '0 0 20px rgba(245,158,11,0.2)',
            }}
          >
            Analyze your idea →
          </a>
          <p className="text-[10px] font-mono text-ink-800 uppercase tracking-wider">Free · No signup required</p>
        </div>

      </div>
    </div>
  )
}
