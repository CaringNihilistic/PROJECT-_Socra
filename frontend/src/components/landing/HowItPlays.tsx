import { COUNCIL, PROFESSOR, STAGES, TEAM_GLITCH, TRAINERS } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import type { SpriteName } from '../../pixel/sprites'

const STEPS: { title: string; sprites: SpriteName[]; body: string[] }[] = [
  {
    title: 'INTERROGATION',
    sprites: [PROFESSOR.sprite, ...STAGES.map((s) => s.sprite)],
    body: [
      'Prof. Socra questions you until he actually understands the idea. No plan until then.',
      'Every good answer earns XP across five stats (clarity, scale, tech, goal, risk), and your idea evolves from egg to final form.',
      'Every assumption he hears becomes a field note you can mark ✓ validated or ✗ disproved.',
    ],
  },
  {
    title: 'THE COUNCIL',
    sprites: Object.values(COUNCIL).map((c) => c.sprite),
    body: [
      'Five advisors research your market live on the web: named competitors, real prices, actual regulations.',
      'Each one hunts for a different reason the idea fails: the money, the market, rivals, the build, the risk.',
    ],
  },
  {
    title: 'THE MASTERPLAN',
    sprites: [...Object.values(TRAINERS).map((t) => t.sprite), TEAM_GLITCH.members[0].sprite],
    body: [
      'The trainers present the Chairman’s plan: verdict, phases, tech stack, first files and a risk register.',
      'Then Team Glitch ambushes it with five reasons it fails.',
      'Export it as Markdown, share a link or a score card, or compare two ideas side by side.',
    ],
  },
]

export function HowItPlays() {
  return (
    <section id="how" aria-labelledby="how-title" className="flex scroll-mt-24 flex-col gap-6">
      <h2 id="how-title" className="font-pixel text-sm leading-relaxed text-px-xp">HOW IT PLAYS</h2>
      <ol className="grid gap-6 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="pixel-panel flex flex-col gap-4 p-5">
            <h3 className="font-pixel text-[11px] leading-relaxed text-px-screen">
              <span className="text-px-xp">{i + 1}.</span> {step.title}
            </h3>
            <div aria-hidden="true" className="flex flex-wrap gap-1">
              {step.sprites.map((s) => (
                <Sprite key={s} name={s} size={64} />
              ))}
            </div>
            {step.body.map((p) => (
              <p key={p} className="text-px-soft">{p}</p>
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}
