import { useEffect, useRef, useState } from 'react'
import { PROFESSOR } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { XpBar } from '../../pixel/ui/XpBar'
import { CAPTION, CHAPTERS, JOURNEY, JOURNEY_EVOLUTION, JOURNEY_MS, SCENE_START, journeyFrame, type JourneyFrame } from '../../landing/journey'
import { SocraDialog } from '../chat/SocraDialog'
import { EvolutionStage } from '../chat/EvolutionStage'
import { CouncilArena } from '../council/CouncilArena'
import { PlanRelay } from '../council/PlanRelay'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** One frame of the demo. Pure: everything comes from the frame. */
export function JourneyStage({ frame, onStart }: { frame: JourneyFrame; onStart: () => void }) {
  const { scene } = frame
  return (
    <div className="flex flex-col gap-5">
      {/* HUD: the idea creature and its XP, in every scene */}
      <div aria-hidden="true" className="flex items-center gap-4">
        <div className="border-4 border-px-ink bg-px-screen p-1">
          <Sprite name={frame.stage.sprite} size={64} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-pixel text-[10px] leading-relaxed text-px-xp">{frame.stage.name.toUpperCase()}</p>
          <XpBar score={frame.score} />
        </div>
      </div>

      <div aria-hidden="true" className="flex flex-col gap-4">
        {scene === 'ask' && (
          <>
            <SocraDialog line={{ kind: 'question', text: JOURNEY.question }} />
            <ul className="flex flex-col gap-2">
              {JOURNEY.choices.map((choice, i) => {
                const on = frame.cursor === i
                const picked = on && frame.picking
                return (
                  <li
                    key={choice}
                    className={`flex min-h-[48px] items-center gap-2.5 border-[3px] px-3.5 py-2 text-[22px] leading-tight ${
                      picked ? 'border-px-xp bg-px-xp text-px-ink' : on ? 'border-px-xp bg-px-night' : 'border-px-edge bg-px-night'
                    }`}
                  >
                    <span className={`font-pixel text-[10px] ${on ? '' : 'invisible'} ${picked ? 'text-px-ink' : 'text-px-xp'}`}>▶</span>
                    {choice}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {scene === 'answer' && (
          <>
            <div className="pixel-panel ml-auto max-w-[85%] px-4 py-3">
              <p className="font-pixel text-[10px] text-px-plan">YOU</p>
              <p className="text-px-soft">{JOURNEY.choices[0]}</p>
            </div>
            <SocraDialog line={{ kind: 'waiting' }} />
          </>
        )}

        {scene === 'evolve' && <EvolutionStage evolution={JOURNEY_EVOLUTION} evolved={frame.evolved} flash={false} />}

        {scene === 'council' && frame.episode && <CouncilArena seats={frame.episode.seats} extras={[]} />}

        {scene === 'plan' && frame.episode && <PlanRelay plan={frame.episode.plan} />}
      </div>

      {scene === 'end' && (
        <div className="flex flex-col items-center gap-5 py-10 text-center">
          <Sprite name={PROFESSOR.sprite} size={96} bob />
          <p className="font-pixel text-sm leading-relaxed text-px-xp">YOUR TURN.</p>
          <p className="text-px-soft">{PROFESSOR.line}</p>
          <PixelButton onClick={onStart}>PRESS START ▶</PixelButton>
        </div>
      )}
    </div>
  )
}

/** "Watch a run": the whole journey, auto-playing on a loop while it is on screen. */
export function JourneyDemo({ onStart }: { onStart: () => void }) {
  const reduced = prefersReducedMotion()
  // Dev only: ?journey=<ms> opens the demo paused at that moment, for reviewing one scene
  const pinned = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('journey') : null
  const [t, setT] = useState(pinned ? Number(pinned) % JOURNEY_MS : 0)
  const [playing, setPlaying] = useState(!reduced && !pinned)
  const [visible, setVisible] = useState(false)
  const box = useRef<HTMLElement>(null)

  // Only run while on screen: nobody watches it scrolled away, and it costs a frame loop
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true)
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // A hidden tab pauses rAF; clamp so returning to it doesn't jump scenes
      const step = Math.min(now - last, 100)
      last = now
      setT((v) => (v + step) % JOURNEY_MS)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, visible])

  const frame = journeyFrame(t)
  const current = [...CHAPTERS].reverse().find((c) => t >= SCENE_START[c.scene])!.scene

  return (
    <section ref={box} aria-labelledby="demo-title" className="pixel-panel flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="demo-title" className="font-pixel text-xs leading-relaxed text-px-xp">WATCH A RUN</h2>
        <div className="flex gap-2">
          <PixelButton variant="secondary" size="sm" onClick={() => setPlaying(!playing)}>
            {playing ? '❚❚ PAUSE' : '▶ PLAY'}
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => { setT(0); setPlaying(true) }}>
            ↺ REPLAY
          </PixelButton>
        </div>
      </div>

      <nav aria-label="Demo scenes">
        <ol className="flex flex-wrap gap-2">
          {CHAPTERS.map((c, i) => (
            <li key={c.scene}>
              <button
                type="button"
                aria-current={current === c.scene ? 'step' : undefined}
                onClick={() => setT(SCENE_START[c.scene])}
                className={`border-2 px-2 py-0.5 text-[20px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan ${
                  current === c.scene ? 'border-px-xp text-px-xp' : 'border-px-edge text-px-muted hover:text-px-screen'
                }`}
              >
                {i + 1} {c.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <p className="text-[20px] text-px-muted">
        <span aria-live="polite">{CAPTION[frame.scene]}</span> <span className="text-px-edge">·</span> A real recorded run: “{JOURNEY.idea}”
      </p>

      <div className="min-h-[640px]">
        <JourneyStage frame={frame} onStart={onStart} />
      </div>
    </section>
  )
}
