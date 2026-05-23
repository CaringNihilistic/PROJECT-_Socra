import { useEffect, useRef, useState } from 'react'
import type { Scores, ScoreExplanation } from '../../store/sessionStore'

interface EvalBarProps {
  scores: Scores
  totalScore: number
  phase: string
  explanations: ScoreExplanation[]
}

const DIMENSIONS = [
  { key: 'problem_clarity', label: 'Problem Clarity', weight: '25%', color: '#f59e0b' },
  { key: 'scale_constraints', label: 'Scale & Constraints', weight: '20%', color: '#e85d26' },
  { key: 'tech_context', label: 'Tech Context', weight: '20%', color: '#22d3ee' },
  { key: 'success_definition', label: 'Success Definition', weight: '20%', color: '#a78bfa' },
  { key: 'risk_awareness', label: 'Risk Awareness', weight: '15%', color: '#34d399' },
]

const PHASE_CONFIG = {
  intake: { label: 'INTAKE', color: '#8a8578', desc: 'Gathering context' },
  debate: { label: 'DEBATE', color: '#f59e0b', desc: 'Proposing & challenging' },
  stress_test: { label: 'STRESS TEST', color: '#e85d26', desc: 'Pressure testing' },
  masterplan: { label: 'MASTERPLAN', color: '#34d399', desc: 'Ready to architect' },
  complete: { label: 'COMPLETE', color: '#34d399', desc: 'Architecture ready' },
}

function AnimatedBar({
  score,
  color,
  delay = 0,
}: {
  score: number
  color: string
  delay?: number
}) {
  const [displayScore, setDisplayScore] = useState(0)
  const prevScore = useRef(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      prevScore.current = displayScore
      setDisplayScore(score)
    }, delay)
    return () => clearTimeout(timeout)
  }, [score, delay])

  return (
    <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-ink-800">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${displayScore * 100}%`,
          background: `linear-gradient(90deg, ${color}88 0%, ${color} 100%)`,
          boxShadow: displayScore > 0 ? `0 0 8px ${color}44` : 'none',
        }}
      />
    </div>
  )
}

export function EvalBar({ scores, totalScore, phase, explanations }: EvalBarProps) {
  const [expanded, setExpanded] = useState(false)
  const phaseConfig = PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG] || PHASE_CONFIG.intake
  const pct = Math.round(totalScore * 100)

  const thresholds = [
    { pct: 40, label: 'Draft', color: '#f59e0b' },
    { pct: 70, label: 'Stress', color: '#e85d26' },
    { pct: 85, label: 'Plan', color: '#34d399' },
  ]

  return (
    <div className="border border-ink-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-900/50 transition-colors"
      >
        <span
          className="phase-badge text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border"
          style={{
            color: phaseConfig.color,
            borderColor: `${phaseConfig.color}44`,
            backgroundColor: `${phaseConfig.color}11`,
          }}
        >
          {phaseConfig.label}
        </span>

        <div className="flex-1 relative">
          <div className="h-2 w-full rounded-full bg-ink-800 overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, #f59e0b, #e85d26 40%, #34d399)`,
                boxShadow: `0 0 12px #f59e0b33`,
              }}
            />
            {thresholds.map((t) => (
              <div
                key={t.pct}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: `${t.pct}%`,
                  backgroundColor: `${t.color}55`,
                }}
              />
            ))}
          </div>
        </div>

        <span className="font-mono text-sm font-medium text-ink-200 tabular-nums w-10 text-right">
          {pct}%
        </span>

        <svg
          className={`w-3.5 h-3.5 text-ink-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-ink-800 px-4 py-3 space-y-3">
          <p className="text-[11px] text-ink-500 font-mono uppercase tracking-widest mb-3">
            5-dimension evaluation
          </p>
          {DIMENSIONS.map((dim, i) => {
            const score = scores[dim.key as keyof Scores] || 0
            const explanation = explanations.find((e) => e.dimension === dim.key)
            return (
              <div key={dim.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: dim.color }}
                    />
                    <span className="text-xs font-medium text-ink-300">{dim.label}</span>
                    <span className="text-[10px] text-ink-600 font-mono">{dim.weight}</span>
                  </div>
                  <span
                    className="text-xs font-mono tabular-nums"
                    style={{ color: dim.color }}
                  >
                    {Math.round(score * 100)}%
                  </span>
                </div>
                <AnimatedBar score={score} color={dim.color} delay={i * 60} />
                {explanation?.status_text && (
                  <p className="text-[11px] text-ink-600 leading-relaxed pl-3.5">
                    {explanation.status_text}
                  </p>
                )}
              </div>
            )
          })}

          <div className="pt-2 border-t border-ink-800/60 flex items-center gap-4">
            {thresholds.map((t) => (
              <div key={t.pct} className="flex items-center gap-1.5">
                <div className="w-1 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="text-[10px] text-ink-600 font-mono">{t.pct}% → {t.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
