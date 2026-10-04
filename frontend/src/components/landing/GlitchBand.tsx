import { TEAM_GLITCH } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'

/**
 * The antagonists, as a full-width band that looks unlike the rest of the page: scanlines, a
 * colour-split heading, and sprites that jitter on hover. Nothing flashes, and the motion is
 * off under prefers-reduced-motion (index.css).
 */
export function GlitchBand() {
  return (
    <section aria-labelledby="glitch-title" className="relative isolate border-y-4 border-px-glitch-dark bg-px-ink">
      <div aria-hidden="true" className="pixel-scanlines absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-[1240px] items-center gap-x-16 gap-y-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex max-w-xl flex-col gap-4">
          <h2 id="glitch-title" className="pixel-split font-pixel text-[20px] leading-snug text-px-screen sm:text-[26px]">
            <span aria-hidden="true" className="mr-3 font-term text-[1.5em] leading-[0] text-px-glitch-text">⚠</span>
            {TEAM_GLITCH.name.toUpperCase()}
          </h2>
          <p className="text-[30px] leading-tight text-px-glitch-text sm:text-[36px]">Not every idea survives.</p>
          <p className="text-px-soft">Once your plan is written, they ambush it with five reasons it fails.</p>
          <p className="text-px-screen">“{TEAM_GLITCH.motto}”</p>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-6 sm:gap-x-12">
          {TEAM_GLITCH.members.map((m) => (
            <li key={m.name} className="flex flex-col items-start gap-2">
              <div className="pixel-jitter">
                <Sprite name={m.sprite} size={64} className="sm:hidden" />
                <Sprite name={m.sprite} size={96} className="hidden sm:block" />
              </div>
              <p className="font-pixel text-[13px] leading-snug text-px-screen">{m.name.toUpperCase()}</p>
              <p className="text-[20px] text-px-glitch-text">{m.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
