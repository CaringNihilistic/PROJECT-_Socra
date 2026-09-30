import { nextStage, stageForScore } from '../cast'

interface XpBarProps {
  /** Total eval score, 0–1 (session.total_score). */
  score: number
}

/** Progress toward the next evolution threshold; full at Final Form. */
export function XpBar({ score }: XpBarProps) {
  // Round down: 39.8% must not read "XP 40 / 40 · 0 to evolve" while still an egg.
  // The epsilon absorbs float noise (0.29 * 100 = 28.999…).
  const xp = Math.floor(Math.min(1, Math.max(0, score)) * 100 + 1e-9)
  const next = nextStage(stageForScore(score))
  const target = next ? Math.round(next.threshold * 100) : 100
  const fill = next ? Math.min(100, (xp / target) * 100) : 100
  const label = next ? `XP ${xp} / ${target} · ${target - xp} to evolve` : 'FINAL FORM'

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Experience toward the next evolution"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={xp}
        aria-valuetext={label}
        className="h-5 border-[3px] border-px-ink bg-px-night shadow-[0_0_0_2px_theme(colors.px.edge)]"
      >
        <div className="pixel-xp-fill h-full" style={{ width: `${fill}%` }} />
      </div>
      <p className="font-term text-[20px] text-px-muted">{label}</p>
    </div>
  )
}
