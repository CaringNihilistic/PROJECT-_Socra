import { COUNCIL, PROFESSOR, STAGES, TEAM_GLITCH, TRAINERS } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import type { SpriteName } from '../../pixel/sprites'

const STEPS: { title: string; sprites: SpriteName[]; lines: string[] }[] = [
  {
    title: 'INTERROGATION',
    sprites: [PROFESSOR.sprite, ...STAGES.map((s) => s.sprite)],
    lines: ['Prof. Socra asks one or two sharp questions a turn.', 'Good answers earn XP across five stats.', 'Your idea evolves from egg to final form.'],
  },
  {
    title: 'THE COUNCIL',
    sprites: Object.values(COUNCIL).map((c) => c.sprite),
    lines: ['Five advisors research your market live on the web.', 'Each one hunts a different reason the idea fails.'],
  },
  {
    title: 'THE MASTERPLAN',
    sprites: [...Object.values(TRAINERS).map((t) => t.sprite), TEAM_GLITCH.members[0].sprite],
    lines: ['A short plan: verdict, tech stack, phases, risks.', 'Team Glitch hits it with five reasons it fails.', 'Export it, share it, or compare two ideas.'],
  },
]

/** The whole game in three steps: a big number, one row of small sprites, a few short lines. */
export function HowItPlays() {
  return (
    <section id="how" aria-labelledby="how-title" className="flex scroll-mt-20 flex-col gap-10">
      <h2 id="how-title" className="font-pixel text-[18px] leading-snug text-px-screen sm:text-[22px]">HOW IT PLAYS</h2>
      <ol className="grid gap-x-12 gap-y-12 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4 border-b-2 border-px-edge pb-3">
              <span aria-hidden="true" className="font-pixel text-[40px] leading-none text-px-psy">0{i + 1}</span>
              {/* One row, never wrapping: 32px sprites, five at most */}
              <div aria-hidden="true" className="flex shrink-0 gap-1">
                {step.sprites.map((s) => (
                  <Sprite key={s} name={s} size={32} />
                ))}
              </div>
            </div>
            <h3 className="font-pixel text-[15px] leading-snug text-px-screen">
              <span className="sr-only">Step {i + 1}: </span>
              {step.title}
            </h3>
            <ul className="flex flex-col gap-2 text-px-soft">
              {step.lines.map((line) => (
                <li key={line} className="leading-snug">{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
