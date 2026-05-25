import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import axios from 'axios'
import type { SessionData, AgentReport } from '../store/sessionStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DIMENSIONS = [
  { key: 'problem_clarity',   label: 'Problem Clarity' },
  { key: 'scale_constraints', label: 'Scale & Constraints' },
  { key: 'tech_context',      label: 'Tech Context' },
  { key: 'success_definition',label: 'Success Definition' },
  { key: 'risk_awareness',    label: 'Risk Awareness' },
] as const

const AGENT_KEYS = ['finance', 'market', 'competition', 'tech', 'risk']

function AgentPairRow({ keyName: _keyName, r1, r2 }: { keyName: string; r1?: AgentReport; r2?: AgentReport }) {
  const [expanded, setExpanded] = useState(false)
  const report = r1 || r2
  if (!report) return null

  return (
    <div className="rounded-xl border border-ink-800/40 overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-base flex-shrink-0">{report.icon}</span>
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider flex-1 text-left text-ink-500">
          {report.title}
        </span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 text-ink-700 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="grid md:grid-cols-2 gap-px bg-ink-800/30 border-t border-ink-800/30">
          {[r1, r2].map((r, idx) => (
            <div key={idx} className="px-4 py-4"
              style={{ background: r ? `${report.color}04` : 'rgba(8,8,9,0.8)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1 h-1 rounded-full flex-shrink-0"
                  style={{ background: idx === 0 ? '#f59e0b' : '#5590e8' }} />
                <span className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: idx === 0 ? 'rgba(245,158,11,0.5)' : 'rgba(85,144,232,0.5)' }}>
                  Idea {idx === 0 ? 'A' : 'B'}
                </span>
              </div>
              {r ? (
                <div className="prose prose-invert max-w-none
                  prose-p:text-ink-500 prose-p:text-[12px] prose-p:my-1 prose-p:leading-relaxed
                  prose-li:text-ink-500 prose-li:text-[12px] prose-li:my-0.5
                  prose-strong:text-ink-300 prose-ul:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[12px] text-ink-800 font-mono italic">No analysis for this idea</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ComparePage({ id1, id2 }: { id1: string; id2: string }) {
  const [s1, setS1] = useState<SessionData | null>(null)
  const [s2, setS2] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      axios.get<SessionData>(`${API_URL}/sessions/${id1}`),
      axios.get<SessionData>(`${API_URL}/sessions/${id2}`),
    ]).then(([r1, r2]) => {
      setS1(r1.data)
      setS2(r2.data)
    }).catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id1, id2])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
          <span className="text-[13px] font-mono text-ink-700">Loading comparison…</span>
        </div>
      </div>
    )
  }

  if (error || !s1 || !s2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#080809' }}>
        <p className="text-ink-600 font-mono text-sm">One or both sessions not found.</p>
        <a href="/" className="text-[13px] font-mono text-amber-400 hover:text-amber-300 transition-colors">← Back to Socra</a>
      </div>
    )
  }

  const scoreA = Math.round(s1.total_score * 100)
  const scoreB = Math.round(s2.total_score * 100)
  const aWins = scoreA > scoreB
  const bWins = scoreB > scoreA

  // Biggest differentiator dimension
  const gaps = DIMENSIONS.map(dim => ({
    label: dim.label,
    gap: Math.abs(
      Math.round((s1.scores[dim.key as keyof typeof s1.scores] as number) * 100) -
      Math.round((s2.scores[dim.key as keyof typeof s2.scores] as number) * 100)
    ),
    aAhead: (s1.scores[dim.key as keyof typeof s1.scores] as number) >= (s2.scores[dim.key as keyof typeof s2.scores] as number),
  })).sort((a, b) => b.gap - a.gap)
  const topGap = gaps[0]

  const hasAgents = (s1.agent_reports?.length ?? 0) > 0 || (s2.agent_reports?.length ?? 0) > 0

  return (
    <div className="min-h-screen" style={{ background: '#080809', backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(85,144,232,0.04) 0%, transparent 55%)' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-800/50"
        style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.5) 30%, rgba(85,144,232,0.5) 70%, transparent 100%)' }} />
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-600">Socra</span>
            <span className="text-ink-800 mx-1">/</span>
            <span className="text-[11px] font-mono text-ink-600 uppercase tracking-[0.1em]">Compare</span>
          </div>
          <a href="/" className="text-[11px] font-mono text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition-all">
            Analyze your idea →
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Idea titles + total scores */}
        <div className="grid items-stretch gap-4" style={{ gridTemplateColumns: '1fr 48px 1fr' }}>
          <div className="rounded-2xl border border-amber-500/15 px-5 py-5 flex flex-col gap-3"
            style={{ background: 'rgba(245,158,11,0.03)' }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-400/50">Idea A</span>
            <p className="text-[15px] font-display font-semibold text-ink-100 leading-snug">{s1.initial_idea}</p>
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-amber-500/10">
              <span className={`text-2xl font-display font-bold tabular-nums ${aWins ? 'text-amber-400' : 'text-ink-500'}`}>
                {scoreA}%
              </span>
              {aWins && <span className="text-[10px] font-mono text-amber-400/60 border border-amber-400/15 bg-amber-400/5 px-2 py-0.5 rounded-full">higher</span>}
              <span className="text-[10px] font-mono text-ink-700 ml-auto capitalize">{s1.phase}</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-ink-700/60 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-mono text-ink-700">vs</span>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/15 px-5 py-5 flex flex-col gap-3"
            style={{ background: 'rgba(85,144,232,0.03)' }}>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-400/50">Idea B</span>
            <p className="text-[15px] font-display font-semibold text-ink-100 leading-snug">{s2.initial_idea}</p>
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-blue-500/10">
              <span className={`text-2xl font-display font-bold tabular-nums ${bWins ? 'text-blue-400' : 'text-ink-500'}`}>
                {scoreB}%
              </span>
              {bWins && <span className="text-[10px] font-mono text-blue-400/60 border border-blue-400/15 bg-blue-400/5 px-2 py-0.5 rounded-full">higher</span>}
              <span className="text-[10px] font-mono text-ink-700 ml-auto capitalize">{s2.phase}</span>
            </div>
          </div>
        </div>

        {/* Score comparison — butterfly bars */}
        <div className="rounded-2xl border border-ink-800/50 px-6 py-6 flex flex-col gap-4"
          style={{ background: 'rgba(13,12,11,0.7)' }}>
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700 mb-1">Score breakdown</p>
          {DIMENSIONS.map(dim => {
            const va = s1.scores[dim.key as keyof typeof s1.scores] as number
            const vb = s2.scores[dim.key as keyof typeof s2.scores] as number
            const pA = Math.round(va * 100)
            const pB = Math.round(vb * 100)
            const wA = pA > pB
            const wB = pB > pA
            return (
              <div key={dim.key} className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr 130px 1fr' }}>
                {/* Left bar — A (fills right-to-left from center) */}
                <div className="flex flex-row-reverse items-center gap-2">
                  <span className={`text-[12px] font-mono tabular-nums flex-shrink-0 w-8 text-right ${wA ? 'text-amber-300' : 'text-ink-600'}`}>{pA}%</span>
                  <div className="flex-1 h-1.5 rounded-full bg-ink-800/60 overflow-hidden">
                    <div className="h-full rounded-full ml-auto transition-all duration-700"
                      style={{ width: `${pA}%`, background: wA ? '#f59e0b' : '#3a3830', boxShadow: wA ? '0 0 6px rgba(245,158,11,0.4)' : 'none' }} />
                  </div>
                </div>
                {/* Dimension label */}
                <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-700 text-center leading-tight">{dim.label}</span>
                {/* Right bar — B */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-ink-800/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pB}%`, background: wB ? '#5590e8' : '#3a3830', boxShadow: wB ? '0 0 6px rgba(85,144,232,0.4)' : 'none' }} />
                  </div>
                  <span className={`text-[12px] font-mono tabular-nums flex-shrink-0 w-8 ${wB ? 'text-blue-300' : 'text-ink-600'}`}>{pB}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Key insight */}
        {topGap.gap > 5 && (
          <div className="px-4 py-3 rounded-xl border border-amber-500/12 text-[12px] font-mono text-amber-400/60"
            style={{ background: 'rgba(245,158,11,0.03)' }}>
            ⚡ Biggest gap: <strong className="text-amber-400/80">{topGap.label}</strong> — Idea {topGap.aAhead ? 'A' : 'B'} leads by {topGap.gap} points.
            {Math.abs(scoreA - scoreB) > 0 && ` Overall score difference: ${Math.abs(scoreA - scoreB)} points.`}
          </div>
        )}

        {/* Agent reports side by side */}
        {hasAgents && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Specialist analysis</p>
            {AGENT_KEYS.map(key => {
              const r1 = s1.agent_reports?.find(r => r.key === key)
              const r2 = s2.agent_reports?.find(r => r.key === key)
              return <AgentPairRow key={key} keyName={key} r1={r1} r2={r2} />
            })}
          </div>
        )}

        {/* Masterplan previews */}
        {(s1.masterplan || s2.masterplan) && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700 mb-3">Architecture masterplans</p>
            <div className="grid md:grid-cols-2 gap-4">
              {[s1, s2].map((s, idx) => (
                <div key={idx} className="rounded-2xl border px-5 py-5 flex flex-col gap-3"
                  style={{
                    borderColor: idx === 0 ? 'rgba(245,158,11,0.12)' : 'rgba(85,144,232,0.12)',
                    background: idx === 0 ? 'rgba(245,158,11,0.02)' : 'rgba(85,144,232,0.02)',
                  }}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full"
                      style={{ background: idx === 0 ? '#f59e0b' : '#5590e8', boxShadow: `0 0 6px ${idx === 0 ? '#f59e0b' : '#5590e8'}` }} />
                    <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">
                      Idea {idx === 0 ? 'A' : 'B'}
                    </span>
                  </div>
                  {s.masterplan ? (
                    <>
                      <p className="text-[13px] text-ink-500 leading-relaxed line-clamp-4 flex-1">
                        {s.masterplan.replace(/#+\s/g, '').replace(/\*\*/g, '').slice(0, 220)}…
                      </p>
                      <a href={`/share/${s.id}`}
                        className="text-[11px] font-mono border border-ink-800 hover:border-ink-700 text-ink-600 hover:text-ink-300 px-3 py-1.5 rounded-lg transition-all self-start mt-auto">
                        View full masterplan →
                      </a>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-800 font-mono italic">No masterplan generated yet</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="rounded-2xl border border-ink-800/40 px-6 py-6 text-center flex flex-col items-center gap-3"
          style={{ background: 'rgba(13,12,11,0.4)' }}>
          <p className="text-[13px] text-ink-500">Want Socra to stress-test your own idea?</p>
          <a href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-mono font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #e85d26)', color: '#08070a', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}>
            Analyze your idea →
          </a>
          <p className="text-[10px] font-mono text-ink-800 uppercase tracking-wider">Free · No signup required</p>
        </div>

      </div>
    </div>
  )
}
