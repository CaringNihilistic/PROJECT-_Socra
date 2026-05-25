import type { Debate } from '../store/sessionStore'

interface Props {
  debate: Debate
}

const ROUND_COLORS = {
  bull: { border: 'rgba(52,211,153,0.2)', bg: 'rgba(52,211,153,0.04)', label: 'rgba(52,211,153,0.7)', dot: '#34d399' },
  bear: { border: 'rgba(239,68,68,0.18)', bg: 'rgba(239,68,68,0.04)', label: 'rgba(239,68,68,0.65)', dot: '#ef4444' },
}

export function DebateView({ debate }: Props) {
  return (
    <div className="rounded-2xl border overflow-hidden fade-up"
      style={{ borderColor: 'rgba(99,102,241,0.18)', background: 'rgba(99,102,241,0.02)' }}>

      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center gap-3"
        style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.03)' }}>
        <span className="text-lg">⚔️</span>
        <div>
          <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400/80">
            AI Debate
          </div>
          <div className="text-[12px] text-ink-500 mt-0.5 leading-snug">{debate.topic}</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px #34d399' }} />
            <span className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider">Bull</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" style={{ boxShadow: '0 0 5px #ef4444' }} />
            <span className="text-[10px] font-mono text-red-400/60 uppercase tracking-wider">Bear</span>
          </div>
        </div>
      </div>

      {/* Rounds */}
      <div className="divide-y" style={{ borderColor: 'rgba(99,102,241,0.08)' }}>
        {debate.rounds.map((round) => (
          <div key={round.round} className="px-5 py-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-indigo-400/50 mb-4 flex items-center gap-2">
              <span className="tabular-nums opacity-50">{round.round}</span>
              <div className="h-px flex-1 bg-indigo-500/10" />
              {round.label}
              <div className="h-px flex-1 bg-indigo-500/10" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Bull */}
              <div className="rounded-xl p-4 border"
                style={{ borderColor: ROUND_COLORS.bull.border, background: ROUND_COLORS.bull.bg }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: ROUND_COLORS.bull.dot, boxShadow: `0 0 4px ${ROUND_COLORS.bull.dot}` }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: ROUND_COLORS.bull.label }}>
                    Bull — VC Optimist
                  </span>
                </div>
                <p className="text-[13px] text-ink-400 leading-relaxed">{round.bull}</p>
              </div>

              {/* Bear */}
              <div className="rounded-xl p-4 border"
                style={{ borderColor: ROUND_COLORS.bear.border, background: ROUND_COLORS.bear.bg }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: ROUND_COLORS.bear.dot, boxShadow: `0 0 4px ${ROUND_COLORS.bear.dot}` }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: ROUND_COLORS.bear.label }}>
                    Bear — Operator Skeptic
                  </span>
                </div>
                <p className="text-[13px] text-ink-400 leading-relaxed">{round.bear}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div className="px-5 py-5 border-t" style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.04)' }}>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-indigo-400/50 mb-3 flex items-center gap-2">
          <span>Verdict</span>
          <div className="h-px flex-1 bg-indigo-500/10" />
        </div>
        <p className="text-[14px] text-ink-300 leading-relaxed">{debate.verdict}</p>
      </div>
    </div>
  )
}
