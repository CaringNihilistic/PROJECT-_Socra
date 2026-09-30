import type { ReactNode } from 'react'
import { COUNCIL, PROFESSOR, TEAM_GLITCH, TRAINERS, type Character } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { TypeBadge } from '../../pixel/ui/TypeBadge'

function CharacterCard({ who, subtitle, badge }: { who: Character; subtitle: string; badge?: ReactNode }) {
  return (
    <li className="pixel-panel flex items-start gap-4 p-4">
      <div className="shrink-0 border-4 border-px-ink bg-px-screen p-1">
        <Sprite name={who.sprite} size={64} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="font-pixel text-[10px] leading-relaxed text-px-screen">{who.name.toUpperCase()}</h4>
        <p className="text-[20px] text-px-xp">{subtitle}</p>
        {badge && <span className="self-start">{badge}</span>}
        <p className="text-px-soft">“{who.line}”</p>
      </div>
    </li>
  )
}

/** Every character, straight from cast.ts. */
export function CastRoster() {
  return (
    <section id="cast" aria-labelledby="cast-title" className="flex scroll-mt-24 flex-col gap-6">
      <h2 id="cast-title" className="font-pixel text-sm leading-relaxed text-px-xp">MEET THE CAST</h2>

      <ul className="grid gap-4 md:grid-cols-2">
        <CharacterCard who={PROFESSOR} subtitle="The interrogator" />
      </ul>

      <h3 className="font-pixel text-[11px] leading-relaxed text-px-screen">THE COUNCIL</h3>
      <ul className="grid gap-4 md:grid-cols-2">
        {Object.values(COUNCIL).map((c) => (
          <CharacterCard key={c.name} who={c} subtitle={`${c.advisor} · ${c.role}`} badge={<TypeBadge type={c.type} />} />
        ))}
      </ul>

      <h3 className="font-pixel text-[11px] leading-relaxed text-px-screen">THE TRAINERS</h3>
      <ul className="grid gap-4 md:grid-cols-2">
        {Object.values(TRAINERS).map((t) => (
          <CharacterCard key={t.name} who={t} subtitle={t.role} />
        ))}
      </ul>

      <div className="pixel-panel pixel-edge-glitch flex flex-col gap-4 p-5">
        <h3 className="font-pixel text-[11px] leading-relaxed text-px-glitch-text">TEAM GLITCH</h3>
        <ul className="flex flex-wrap gap-6">
          {TEAM_GLITCH.members.map((m) => (
            <li key={m.name} className="flex items-center gap-3">
              <Sprite name={m.sprite} size={64} />
              <div>
                <p className="font-pixel text-[10px] leading-relaxed">{m.name.toUpperCase()}</p>
                <p className="text-[20px] text-px-muted">{m.role}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[24px]">“{TEAM_GLITCH.motto}”</p>
      </div>
    </section>
  )
}
