import { COUNCIL, PROFESSOR, type CouncilKey, type CreatureType } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { TypeBadge } from '../../pixel/ui/TypeBadge'

// Full class strings so Tailwind's scanner sees them: each advisor's type colour, as a thin top rule
const ACCENT: Record<CreatureType, string> = {
  steel: 'border-px-steel',
  psychic: 'border-px-psychic',
  fighting: 'border-px-fighting',
  electric: 'border-px-electric',
  ghost: 'border-px-ghost',
}

// What each advisor goes after, in words: the type pill alone would only be a colour and a name
const ATTACKS: Record<CouncilKey, string> = {
  finance: 'the money',
  market: 'the market',
  competition: 'your rivals',
  tech: 'the build',
  risk: 'the risk',
}

/** Meet the council: Prof. Socra as the interrogator, then the five advisors, straight from cast.ts. */
export function CastRoster() {
  return (
    <section id="cast" aria-labelledby="cast-title" className="flex scroll-mt-20 flex-col gap-12">
      <div className="flex flex-col gap-3">
        <h2 id="cast-title" className="font-pixel text-[18px] leading-snug text-px-screen sm:text-[22px]">MEET THE COUNCIL</h2>
        <p className="text-px-soft">The ones who will try to kill your idea.</p>
      </div>

      {/* The interrogator gets his own spot: he comes first, and the council waits for him */}
      <div className="pixel-hop-host flex flex-col gap-6 border-l-4 border-px-xp pl-5 sm:flex-row sm:items-center sm:gap-10 sm:pl-8">
        <div className="pixel-hop shrink-0">
          <Sprite name={PROFESSOR.sprite} size={96} className="sm:hidden" />
          <Sprite name={PROFESSOR.sprite} size={128} className="hidden sm:block" />
        </div>
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="font-pixel text-[11px] leading-relaxed text-px-xp">{PROFESSOR.role.toUpperCase()}</p>
          <h3 className="font-pixel text-[16px] leading-snug text-px-screen sm:text-[18px]">{PROFESSOR.name.toUpperCase()}</h3>
          <p className="text-[26px] leading-snug text-px-screen sm:text-[28px]">“{PROFESSOR.line}”</p>
          <p className="text-px-soft">He questions you first. The council only convenes once he understands the idea.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {(Object.keys(COUNCIL) as CouncilKey[]).map((key) => {
            const c = COUNCIL[key]
            return (
              <li key={key} className={`pixel-hop-host pixel-lift flex gap-4 border-t-4 pt-5 sm:flex-col sm:gap-3 ${ACCENT[c.type]}`}>
                <div className="pixel-hop shrink-0 self-start border-4 border-px-ink bg-px-screen p-1">
                  <Sprite name={c.sprite} size={64} className="sm:hidden" />
                  <Sprite name={c.sprite} size={96} className="hidden sm:block" />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <div>
                    <h3 className="font-pixel text-[14px] leading-snug text-px-screen">{c.name.toUpperCase()}</h3>
                    <p className="text-[20px] text-px-xp">{c.advisor} · {c.role}</p>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[20px] text-px-muted">
                    <TypeBadge type={c.type} />
                    <span>attacks {ATTACKS[key]}</span>
                  </p>
                  <p className="text-[22px] leading-snug text-px-soft">“{c.line}”</p>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-[20px] text-px-muted">Each advisor has a type. It names what that advisor goes after when it researches your idea.</p>
      </div>
    </section>
  )
}
