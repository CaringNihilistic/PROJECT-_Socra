import type { ReactNode } from 'react'
import { BRIGHT_STARS, DIM_STARS, FAR_CLOUDS, FAR_HILLS, NEAR_CLOUDS, NEAR_HILLS, svg } from './scenery'

/*
 * The title screen's scenery: a pixel night sky, a moon, drifting clouds and rolling hills.
 * Purely decorative (aria-hidden); the stars and hills are repeating SVG tiles so their pixels
 * stay square at any width.
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

export function TitleScene({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Sky: a horizon glow, dim stars, then a twinkling layer of brighter ones */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-px-night via-px-night to-[#2a2652]" />
      <div aria-hidden="true" className="pixel-fade-down absolute inset-0 -z-10" style={{ backgroundImage: DIM_STARS }} />
      <div aria-hidden="true" className="pixel-fade-down absolute inset-0 -z-10">
        <div className="pixel-twinkle absolute inset-0" style={{ backgroundImage: BRIGHT_STARS, backgroundPosition: '120px 60px' }} />
      </div>
      <div aria-hidden="true" className="absolute right-[4%] top-8 -z-10 hidden h-16 w-16 md:block" style={{ backgroundImage: MOON, backgroundSize: '64px 64px' }} />
      {/* A calm, darker patch behind the title: stars stay in the margins, not between letters */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[26rem] bg-[radial-gradient(ellipse_40rem_12rem_at_50%_9rem,theme(colors.px.night)_35%,transparent_75%)]" />

      <div className="mx-auto max-w-6xl px-4 pb-40 pt-10 sm:px-6 sm:pt-12">{children}</div>

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
