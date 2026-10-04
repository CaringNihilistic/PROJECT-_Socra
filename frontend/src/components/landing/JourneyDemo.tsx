import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { COUNCIL, PROFESSOR, TRAINERS } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import type { SpriteName } from '../../pixel/sprites'
import { Arrow, PixelButton } from '../../pixel/ui/PixelButton'
import { XpBar } from '../../pixel/ui/XpBar'
import { CAPTION, CHAPTERS, JOURNEY, JOURNEY_EVOLUTION, JOURNEY_MS, SCENE_START, journeyFrame, type JourneyFrame } from '../../landing/journey'
import { STAGE_MEANING } from '../../chat/turns'
import { parseSections, sectionTail } from '../../episode/sections'
import { plainText } from '../../episode/signature'
import type { EpisodeState } from '../../episode/reducer'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ring = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-px-plan'

/** Someone speaking: a 64px sprite and a few clamped lines. The largest text in the demo. */
function Speech({ speaker, sprite, children }: { speaker: string; sprite: SpriteName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-4 border-px-ink bg-px-screen px-4 py-3 sm:px-5 sm:py-4">
      <Sprite name={sprite} size={64} />
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[11px] leading-relaxed text-px-ghost">{speaker}</p>
        <div className="text-[22px] leading-snug text-px-ink sm:text-[26px]">{children}</div>
      </div>
    </div>
  )
}

/** The council in one row, and the finding of whoever reported last. */
function CouncilStrip({ seats }: { seats: EpisodeState['seats'] }) {
  const latest = [...seats].reverse().find((s) => s.status === 'done' && s.signature)
  return (
    <div className="flex flex-col gap-4">
      <p className="font-pixel text-[12px] leading-relaxed text-px-xp">THE COUNCIL</p>
      <ul className="grid grid-cols-5 gap-2 sm:flex sm:gap-5">
        {seats.map((seat) => {
          const creature = COUNCIL[seat.key]
          const done = seat.status === 'done'
          return (
            <li key={seat.key} className="flex flex-col items-center gap-1">
              <div className={`border-[3px] bg-px-screen ${done ? 'border-px-plan' : 'border-px-ink'} ${seat === latest ? 'pixel-attack' : ''}`}>
                {/* Two sizes rather than CSS scaling: sprites only render at whole-number scales */}
                <Sprite name={creature.sprite} size={32} bob={!done} className="m-1 sm:hidden" />
                <Sprite name={creature.sprite} size={64} bob={!done} className="hidden sm:block" />
              </div>
              <span className="hidden font-pixel text-[10px] leading-relaxed sm:block">{creature.name.toUpperCase()}</span>
            </li>
          )
        })}
      </ul>
      {latest ? (
        <Speech speaker={COUNCIL[latest.key].name.toUpperCase()} sprite={COUNCIL[latest.key].sprite}>
          <p className="line-clamp-3">“{latest.signature}”</p>
        </Speech>
      ) : (
        <p className="text-px-muted">
          Researching your market<span className="pixel-blink">…</span>
        </p>
      )}
    </div>
  )
}

/** The plan as it is written: the trainer who owns the current section, and the sections so far. */
function PlanStrip({ plan }: { plan: EpisodeState['plan'] }) {
  const sections = parseSections(plan.text)
  const current = sections[sections.length - 1]
  const trainer = current?.trainer ?? TRAINERS.kai
  const headed = sections.filter((s) => s.heading)
  return (
    <div className="flex flex-col gap-4">
      <Speech speaker={trainer.name.toUpperCase()} sprite={trainer.sprite}>
        {current?.heading && <p className="font-pixel text-[11px] leading-relaxed text-px-ghost">{current.heading}</p>}
        <p className="line-clamp-4">
          {current ? sectionTail(current.body, 200) : 'Gathering the council’s findings…'}
          {plan.status !== 'done' && <span className="pixel-blink">▌</span>}
        </p>
      </Speech>
      <ol className="flex max-h-[80px] flex-wrap gap-2 overflow-hidden">
        {headed.map((s, i) => (
          <li key={`${i}-${s.heading}`} className="border-2 border-px-plan px-2 text-[20px] text-px-plan">
            ✓ {s.heading}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** One frame of the demo. Pure: everything comes from the frame. Every scene fits the stage's fixed height. */
export function JourneyStage({ frame }: { frame: JourneyFrame }) {
  const { scene } = frame
  const { from, to } = JOURNEY_EVOLUTION
  return (
    <div aria-hidden="true" className="flex max-w-3xl flex-col gap-4">
      {scene === 'ask' && (
        <>
          <Speech speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
            <p className="line-clamp-4">{plainText(JOURNEY.question)}</p>
          </Speech>
          <ul className="flex flex-col gap-2">
            {JOURNEY.choices.map((choice, i) => {
              const on = frame.cursor === i
              const picked = on && frame.picking
              return (
                <li
                  key={choice}
                  className={`flex items-center gap-3 border-[3px] px-3 py-1.5 text-[22px] sm:px-4 sm:text-[24px] ${
                    picked ? 'border-px-xp bg-px-xp text-px-ink' : on ? 'border-px-xp bg-px-night' : 'border-px-edge bg-px-night'
                  }`}
                >
                  <span className={`font-pixel text-[10px] ${on ? '' : 'invisible'} ${picked ? 'text-px-ink' : 'text-px-xp'}`}>▶</span>
                  <span className="truncate">{choice}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {scene === 'answer' && (
        <>
          <div className="ml-auto max-w-[85%] border-2 border-px-plan-dark bg-px-night px-4 py-3">
            <p className="font-pixel text-[11px] leading-relaxed text-px-plan">YOU</p>
            <p className="line-clamp-2 text-[22px] text-px-screen sm:text-[24px]">{JOURNEY.choices[0]}</p>
          </div>
          <Speech speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
            <span className="pixel-blink">…</span>
          </Speech>
        </>
      )}

      {scene === 'evolve' && (
        <div className="flex flex-col items-center gap-5 pt-2">
          {frame.evolved ? (
            <Sprite name={to.sprite} size={96} bob />
          ) : (
            // The silhouette filter goes on each sprite: on the wrapper it would whiten the backing too
            <div className="relative h-24 w-24">
              <Sprite name={to.sprite} size={96} className="pixel-silhouette absolute inset-0" />
              <div className="pixel-evolve-old absolute inset-0 bg-px-panel">
                <Sprite name={from.sprite} size={96} className="pixel-silhouette" />
              </div>
            </div>
          )}
          <div className="w-full border-4 border-px-ink bg-px-screen px-5 py-4 text-[22px] leading-snug text-px-ink sm:text-[26px]">
            {frame.evolved ? (
              <>
                <p>Congratulations! Your idea evolved into {to.name.toUpperCase()}!</p>
                <p className="mt-1">{STAGE_MEANING[to.phase]}</p>
              </>
            ) : (
              <p>What? {from.name.toUpperCase()} is evolving!</p>
            )}
          </div>
        </div>
      )}

      {scene === 'council' && frame.episode && <CouncilStrip seats={frame.episode.seats} />}

      {scene === 'plan' && frame.episode && <PlanStrip plan={frame.episode.plan} />}

      {scene === 'end' && (
        <div className="flex flex-col items-center gap-4 pt-6 text-center">
          <Sprite name={PROFESSOR.sprite} size={96} bob />
          <p className="font-pixel text-[18px] leading-relaxed text-px-xp">YOUR TURN.</p>
          <p className="text-px-soft">{PROFESSOR.line}</p>
        </div>
      )}
    </div>
  )
}

/** Re-render in 100ms steps: every animation frame would re-render the stage ~60 times a second. */
const STEP_MS = 100

/**
 * "Here's what happens next": a real recorded run on a loop, as its own section under the hero.
 * A step rail (ASK → EVOLVE → COUNCIL → PLAN) jumps between scenes; the stage has a fixed height.
 */
export function JourneyDemo({ onStart }: { onStart: () => void }) {
  const reduced = prefersReducedMotion()
  // Dev only: ?journey=<ms> opens the demo paused at that moment, for reviewing one scene
  const pinnedParam = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('journey') : null
  const pinned = pinnedParam !== null && Number.isFinite(Number(pinnedParam)) ? Number(pinnedParam) : null
  const [t, setT] = useState(pinned !== null ? journeyFrame(pinned).t : 0)
  const [playing, setPlaying] = useState(!reduced && pinned === null)
  const [visible, setVisible] = useState(false)
  const box = useRef<HTMLElement>(null)
  const elapsed = useRef(t)
  const jump = (ms: number) => {
    elapsed.current = ms
    setT(ms)
  }

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
      elapsed.current = (elapsed.current + Math.min(now - last, 100)) % JOURNEY_MS
      last = now
      const stepped = elapsed.current - (elapsed.current % STEP_MS)
      setT((v) => (v === stepped ? v : stepped))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, visible])

  const frame = useMemo(() => journeyFrame(t), [t])
  const currentIndex = CHAPTERS.length - 1 - [...CHAPTERS].reverse().findIndex((c) => t >= SCENE_START[c.scene])

  return (
    <section ref={box} aria-labelledby="demo-title" className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 id="demo-title" className="font-pixel text-[18px] leading-snug text-px-screen sm:text-[22px]">HERE’S WHAT HAPPENS NEXT</h2>
          <p className="text-px-soft">A real run, recorded and replayed: “{JOURNEY.idea}”</p>
        </div>
        <div className="flex gap-2">
          <PixelButton variant="secondary" size="sm" lift className="max-sm:!min-h-[44px]" onClick={() => setPlaying(!playing)}>
            {playing ? '❚❚ PAUSE' : '▶ PLAY'}
          </PixelButton>
          <PixelButton variant="secondary" size="sm" lift className="max-sm:!min-h-[44px]" onClick={() => { jump(0); setPlaying(true) }}>
            ↺ REPLAY
          </PixelButton>
        </div>
      </div>

      {/* Game UI, so it keeps a frame: one border, not the kit's double ring */}
      <div className="border-2 border-px-edge bg-px-panel">
        <nav aria-label="Demo scenes" className="border-b-2 border-px-edge px-2 py-2 sm:px-6 sm:py-3">
          <ol className="flex items-center sm:gap-3">
            {CHAPTERS.map((c, i) => {
              const active = i === currentIndex
              const done = i < currentIndex
              return (
                <li key={c.scene} className="flex flex-1 items-center sm:gap-3 sm:last:flex-none">
                  <button
                    type="button"
                    aria-current={active ? 'step' : undefined}
                    onClick={() => jump(SCENE_START[c.scene])}
                    className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 px-1 font-pixel text-[11px] transition-colors duration-150 sm:flex-none sm:flex-row sm:gap-3 sm:px-2 sm:text-[13px] ${ring} ${
                      active ? 'text-px-xp' : done ? 'text-px-screen' : 'text-px-muted hover:text-px-screen'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center border-2 ${
                        active ? 'border-px-xp bg-px-xp text-px-ink' : done ? 'border-px-plan text-px-plan' : 'border-px-edge'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {c.label}
                  </button>
                  {i < CHAPTERS.length - 1 && (
                    <span aria-hidden="true" className={`hidden h-[2px] flex-1 sm:block ${done ? 'bg-px-plan' : 'bg-px-edge'}`} />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12 lg:p-8">
          <div className="flex flex-col gap-4">
            {/* HUD: the idea creature and its XP, in every scene */}
            <div aria-hidden="true" className="flex items-center gap-4 lg:flex-col lg:items-start">
              <div className="border-4 border-px-ink bg-px-screen p-1">
                <Sprite name={frame.stage.sprite} size={64} className="lg:hidden" />
                <Sprite name={frame.stage.sprite} size={96} className="hidden lg:block" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 lg:w-full">
                <p className="font-pixel text-[12px] leading-relaxed text-px-xp">{frame.stage.name.toUpperCase()}</p>
                <XpBar score={frame.score} />
              </div>
            </div>
            <p aria-live="polite" className="min-h-[2.6em] text-[20px] leading-snug text-px-soft">{CAPTION[frame.scene]}</p>
          </div>

          {/* A fixed stage: every scene fits inside it, so the box never changes height as it loops.
              Paused means paused: freeze the CSS animations (bob, blink, the evolution flicker) too */}
          <div id="demo-stage" className={`h-[400px] overflow-hidden sm:h-[380px] ${playing ? '' : '[&_*]:![animation-play-state:paused]'}`}>
            {/* Each scene fades in, but only while playing: a paused animation would freeze it invisible */}
            <div key={frame.scene} className={playing ? 'pixel-scene-in' : ''}>
              <MemoStage frame={frame} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <PixelButton lift onClick={onStart}>TEST YOUR IDEA<Arrow /></PixelButton>
      </div>
    </section>
  )
}

const MemoStage = memo(JourneyStage)
