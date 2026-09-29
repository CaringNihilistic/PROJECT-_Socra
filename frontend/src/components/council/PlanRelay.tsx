import { TRAINERS } from '../../pixel/cast'
import { DialogBox } from '../../pixel/ui/DialogBox'
import { parseSections, sectionTail } from '../../episode/sections'
import type { EpisodeState } from '../../episode/reducer'

/** The trainer relay: the plan types out in the voice of whoever owns the current section. */
export function PlanRelay({ plan }: { plan: EpisodeState['plan'] }) {
  if (plan.status === 'failed') {
    return (
      <DialogBox speaker={TRAINERS.kai.name.toUpperCase()} sprite={TRAINERS.kai.sprite}>
        We dropped the plan! The synthesis came back empty.
      </DialogBox>
    )
  }

  const sections = parseSections(plan.text)
  const current = sections[sections.length - 1]
  const trainer = current?.trainer ?? TRAINERS.kai
  const writing = plan.status !== 'done'
  const headed = sections.filter((s) => s.heading)

  return (
    <div className="flex flex-col gap-5">
      <DialogBox speaker={trainer.name.toUpperCase()} sprite={trainer.sprite} more={!writing}>
        {current?.heading && <span className="mb-1 block font-pixel text-[11px] leading-relaxed text-px-ghost">{current.heading}</span>}
        <span className="block max-h-[9em] overflow-hidden">
          {current ? sectionTail(current.body) : 'Gathering the council’s findings…'}
          {writing && <span className="pixel-blink" aria-hidden="true">▌</span>}
        </span>
      </DialogBox>
      {headed.length > 0 && (
        <ol aria-label="Masterplan sections" className="flex flex-wrap gap-2">
          {headed.map((s, i) => {
            const active = writing && i === headed.length - 1
            return (
              <li
                key={`${i}-${s.heading}`}
                className={`border-2 px-2 py-0.5 text-[20px] ${active ? 'border-px-xp text-px-xp' : 'border-px-plan text-px-plan'}`}
              >
                <span aria-hidden="true">{active ? '▶ ' : '✓ '}</span>
                {s.heading}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
