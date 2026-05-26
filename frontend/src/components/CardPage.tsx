import { useEffect, useState } from 'react'
import axios from 'axios'
import type { SessionData } from '../store/sessionStore'
import { VerdictCard } from './VerdictCard'
import { TribunalCard } from './TribunalCard'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function CardPage({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    axios.get<SessionData>(`${API_URL}/sessions/${sessionId}`)
      .then(r => setSession(r.data))
      .finally(() => setLoading(false))
  }, [sessionId])

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="w-6 h-6 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <p className="text-[13px] font-mono text-ink-700">Card not found.</p>
      </div>
    )
  }

  const isTribunal = !!(session.tribunal_verdicts)
  const score = Math.round(session.total_score * 100)
  const glowColor = isTribunal
    ? session.tribunal_verdicts!.grade === 'GREENLIT' ? 'rgba(52,211,153,0.06)'
      : session.tribunal_verdicts!.grade === 'STRONG' ? 'rgba(245,158,11,0.06)'
      : 'rgba(220,38,38,0.05)'
    : score >= 80 ? 'rgba(52,211,153,0.06)' : score >= 60 ? 'rgba(245,158,11,0.06)' : 'rgba(232,93,38,0.05)'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        background: '#080809',
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${glowColor} 0%, transparent 60%)`,
      }}>

      {/* Card */}
      {isTribunal ? (
        <TribunalCard
          idea={session.initial_idea}
          verdicts={session.tribunal_verdicts!}
          sessionId={sessionId}
        />
      ) : (
        <VerdictCard
          idea={session.initial_idea}
          totalScore={session.total_score}
          scores={session.scores}
          explanations={session.explanations}
          sessionId={sessionId}
        />
      )}

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleCopy}
          className="text-[12px] font-mono px-5 py-2.5 rounded-xl border transition-all duration-200"
          style={copied ? {
            color: '#34d399', borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.06)',
          } : {
            color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)', background: 'transparent',
          }}
        >
          {copied ? '✓ Link copied' : '↗ Copy link'}
        </button>
        <a
          href="/"
          className="text-[12px] font-mono px-5 py-2.5 rounded-xl border transition-all duration-200"
          style={{
            color: '#f59e0b', borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.05)',
          }}
        >
          Run your idea →
        </a>
      </div>

      {/* Tweet prompt */}
      <p className="mt-8 text-[11px] font-mono text-ink-800 text-center max-w-xs leading-relaxed">
        Share your score on LinkedIn or Twitter and tag it{' '}
        <span className="text-ink-600">#SocraScore</span>
      </p>
    </div>
  )
}
