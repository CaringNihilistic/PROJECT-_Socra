import { useState } from 'react'
import type { Stage } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { StatBar } from '../../pixel/ui/StatBar'
import { XpBar } from '../../pixel/ui/XpBar'
import { STAT_ROWS, type StatKey } from '../../chat/turns'

interface IdeaCardProps {
  stage: Stage
  score: number
  scores: Partial<Record<StatKey, number>>
  explanations: { dimension: string; status_text: string }[]
}

/** Your idea as a creature: its stage, XP toward the next evolution, and the five eval stats. */
export function IdeaCard({ stage, score, scores, explanations }: IdeaCardProps) {
  const [open, setOpen] = useState<StatKey | null>(null)

  return (
    <section aria-label="Your idea" className="pixel-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-8 sm:p-6">
      <div className="flex items-center gap-4 sm:w-44 sm:flex-col sm:items-center">
        {/* Two sizes rather than CSS scaling: sprites only render at whole-number scales */}
        <div className="border-4 border-px-ink bg-px-screen p-2">
          <Sprite name={stage.sprite} size={96} bob className="sm:hidden" />
          <Sprite name={stage.sprite} size={128} bob className="hidden sm:block" />
        </div>
        <div className="flex flex-col gap-1 sm:items-center">
          <p className="text-[20px] text-px-muted">YOUR IDEA</p>
          <h2 className="font-pixel text-[11px] leading-relaxed text-px-xp">{stage.name.toUpperCase()}</h2>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* The stage wins over a lagging score (e.g. an admin skip straight to the masterplan) */}
        <XpBar score={Math.max(score, stage.threshold)} />
        <ul className="flex flex-col gap-1.5">
          {STAT_ROWS.map(({ key, label }) => {
            const value = scores[key] ?? 0
            const note = explanations.find((e) => e.dimension === key)?.status_text
            const isOpen = open === key
            return (
              <li key={key}>
                {note ? (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`stat-note-${key}`}
                    onClick={() => setOpen(isOpen ? null : key)}
                    className="w-full text-left hover:bg-px-night focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan"
                  >
                    <StatBar label={label} value={value} width="compact" hint={isOpen ? '▾' : '▸'} />
                  </button>
                ) : (
                  <StatBar label={label} value={value} width="compact" />
                )}
                {note && isOpen && (
                  <p id={`stat-note-${key}`} className="mt-1 border-l-4 border-px-edge py-1 pl-3 text-[22px] text-px-soft">
                    {note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
