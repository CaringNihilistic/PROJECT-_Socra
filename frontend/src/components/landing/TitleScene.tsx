import type { ReactNode } from 'react'
import { COUNCIL, type Creature } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { BRIGHT_STARS, DIM_STARS, FAR_CLOUDS, FAR_HILLS, NEAR_CLOUDS, NEAR_HILLS, svg } from './scenery'

/*
 * The title screen's scenery: a pixel night sky, a moon, rolling hills, and the council waiting
 * in the side gutters on wide screens. Purely decorative (aria-hidden); the stars and hills are
 * repeating SVG tiles so their pixels stay square at any width.
 */

// A 16x16 pixel moon with two craters, shown at 4x
const MOON = svg(
  16,
  16,
  [
    [5, 1, 6], [3, 2, 10], [2, 3, 12], [1, 4, 14], [1, 5, 14], [0, 6, 16], [0, 7, 16], [0, 8, 16], [0, 9, 16],
    [1, 10, 14], [1, 11, 14], [2, 12, 12], [3, 13, 10], [5, 14, 6],
  ]
    .map(([x, y, w]) => `<rect x='${x}' y='${y}' width='${w}' height='1' fill='#f4ecd8'/>`)
    .join('') +
    `<rect x='4' y='5' width='3' height='2' fill='#d8cdb0'/><rect x='9' y='9' width='2' height='2' fill='#d8cdb0'/><rect x='10' y='4' width='2' height='1' fill='#d8cdb0'/>`,
)

/** A battle platform: a stepped oval under each creature. */
function Platform() {
  return (
    <svg viewBox="0 0 32 6" width={128} height={24} shapeRendering="crispEdges" aria-hidden="true" className="-mt-3">
      <rect x="6" y="0" width="20" height="1" fill="#3a3566" />
      <rect x="2" y="1" width="28" height="1" fill="#3a3566" />
      <rect x="0" y="2" width="32" height="2" fill="#3a3566" />
      <rect x="2" y="4" width="28" height="1" fill="#221f3f" />
      <rect x="6" y="5" width="20" height="1" fill="#221f3f" />
    </svg>
  )
}

function Waiting({ creature, delay }: { creature: Creature; delay: number }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="pixel-bob" style={{ animationDelay: `${delay}ms` }}>
        <Sprite name={creature.sprite} size={96} />
      </div>
      <Platform />
      <figcaption className="font-pixel text-[10px] text-px-muted">{creature.name.toUpperCase()}</figcaption>
    </figure>
  )
}

const LEFT = [COUNCIL.finance, COUNCIL.competition]
const RIGHT = [COUNCIL.market, COUNCIL.tech, COUNCIL.risk]

export function TitleScene({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Sky: a horizon glow, dim stars, then a twinkling layer of brighter ones */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-px-night via-px-night to-[#2a2652]" />
      <div aria-hidden="true" className="pixel-fade-down absolute inset-0 -z-10" style={{ backgroundImage: DIM_STARS }} />
      <div aria-hidden="true" className="pixel-fade-down absolute inset-0 -z-10">
        <div className="pixel-twinkle absolute inset-0" style={{ backgroundImage: BRIGHT_STARS, backgroundPosition: '120px 60px' }} />
      </div>
      <div aria-hidden="true" className="absolute right-[7%] top-10 -z-10 hidden h-16 w-16 md:block" style={{ backgroundImage: MOON, backgroundSize: '64px 64px' }} />
      {/* A calm, darker patch behind the title and idea box: stars stay in the margins, not between letters */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[56rem] bg-[radial-gradient(ellipse_44rem_30rem_at_50%_22rem,theme(colors.px.night)_35%,transparent_75%)]" />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 px-4 pb-44 pt-12 sm:px-6 sm:pt-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
        {/* The council waits in the gutters, staggered so it doesn't read as two columns of icons */}
        <div aria-hidden="true" className="hidden flex-col items-end gap-24 pr-6 pt-[26rem] xl:flex">
          {LEFT.map((c, i) => (
            <Waiting key={c.name} creature={c} delay={i * 450} />
          ))}
        </div>
        <div className="min-w-0">{children}</div>
        <div aria-hidden="true" className="hidden flex-col items-start gap-20 pl-6 pt-[20rem] xl:flex">
          {RIGHT.map((c, i) => (
            <Waiting key={c.name} creature={c} delay={200 + i * 380} />
          ))}
        </div>
      </div>

      {/* Clouds drift in the low sky where the stars fade out: a dim far band and a nearer,
          lighter one moving faster, for parallax */}
      <div aria-hidden="true" className="pixel-drift-slow absolute inset-x-0 bottom-[9.5rem] -z-10 h-6" style={{ backgroundImage: FAR_CLOUDS, backgroundSize: '560px 24px' }} />
      <div aria-hidden="true" className="pixel-drift absolute inset-x-0 bottom-[3.5rem] -z-10 h-12" style={{ backgroundImage: NEAR_CLOUDS, backgroundSize: '960px 48px' }} />

      {/* Hills: a far range on solid ground, then a near range in the page colour so the scene
          melts into the next section */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-6 -z-10 h-12" style={{ backgroundImage: FAR_HILLS, backgroundSize: '192px 48px', backgroundRepeat: 'repeat-x' }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-6 bg-px-panel" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-12" style={{ backgroundImage: NEAR_HILLS, backgroundSize: '192px 48px', backgroundRepeat: 'repeat-x', backgroundPosition: '40px 0' }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-2 bg-px-night" />
    </section>
  )
}
