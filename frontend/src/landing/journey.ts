/**
 * The landing page's journey demo as a pure timeline: `journeyFrame(t)` says what to show at
 * time t. Content is excerpts of one real recorded run (see __fixtures__/journey.json).
 * docs/superpowers/specs/2026-09-30-socra-landing-design.md §3
 */
import data from './__fixtures__/journey.json'
import { toEpisodeEvent, type EpisodeEvent } from '../episode/events'
import { episodeReducer, initialEpisode, type EpisodeState } from '../episode/reducer'
import { STAGES, type Stage } from '../pixel/cast'
import type { Evolution, StatKey } from '../chat/turns'

export const JOURNEY = data

export const JOURNEY_MS = 23000

export type Scene = 'ask' | 'answer' | 'evolve' | 'council' | 'plan' | 'end'

/** When each scene starts, in order. */
export const SCENE_START: Record<Scene, number> = {
  ask: 0,
  answer: 3500,
  evolve: 5000,
  council: 8500,
  plan: 15000,
  end: 20000,
}

/** The scenes the demo's strip can jump to. */
export const CHAPTERS: { scene: Scene; label: string }[] = [
  { scene: 'ask', label: 'ASK' },
  { scene: 'evolve', label: 'EVOLVE' },
  { scene: 'council', label: 'COUNCIL' },
  { scene: 'plan', label: 'PLAN' },
]

/** A one-line caption per scene, also announced to screen readers. */
export const CAPTION: Record<Scene, string> = {
  ask: 'Turn 1: Prof. Socra asks.',
  answer: 'Turn 1: you answer.',
  evolve: `Turn ${data.after.turn}: your idea reaches ${Math.round(data.after.total_score * 100)}% and evolves.`,
  council: `Turn ${data.final.turn}: at ${Math.round(data.final.total_score * 100)}% the council convenes.`,
  plan: 'The trainers present the masterplan.',
  end: 'Your turn.',
}

const CURSOR_MOVES: [number, number][] = [[0, 0], [1400, 1], [2400, 0]]
const PICK_AT = 3000
const EVOLVED_AT = 7400
const REPORT_AT = [9300, 10300, 11300, 12300, 13300]
const PLAN_MS = 4500

const [egg, hatchling, , final] = STAGES
export const JOURNEY_EVOLUTION: Evolution = { from: egg, to: hatchling }

export interface JourneyFrame {
  t: number
  scene: Scene
  stage: Stage
  score: number
  scores: Partial<Record<StatKey, number>>
  /** Menu cursor (ask scene only). */
  cursor: number | null
  /** The cursor's choice is being picked (flash). */
  picking: boolean
  /** Evolution: false while flickering, true once evolved. */
  evolved: boolean
  /** Council and plan scenes: the real episode reducer over the events due by t. */
  episode: EpisodeState | null
}

const reports = data.reports.map((report) => toEpisodeEvent({ type: 'agent_report', report }) as EpisodeEvent)

export function sceneAt(t: number): Scene {
  const scenes = Object.keys(SCENE_START) as Scene[]
  return [...scenes].reverse().find((s) => t >= SCENE_START[s]) ?? 'ask'
}

export function journeyFrame(time: number): JourneyFrame {
  const t = ((time % JOURNEY_MS) + JOURNEY_MS) % JOURNEY_MS
  const scene = sceneAt(t)
  const snapshot = t < SCENE_START.evolve ? data.before : t < SCENE_START.council ? data.after : data.final
  const stage = t < EVOLVED_AT ? egg : t < SCENE_START.council ? hatchling : final

  let episode: EpisodeState | null = null
  if (t >= SCENE_START.council) {
    const events = reports.filter((_, i) => t >= REPORT_AT[i])
    if (t >= SCENE_START.plan) {
      const share = Math.min(1, (t - SCENE_START.plan) / PLAN_MS)
      const text = data.plan.slice(0, Math.floor(data.plan.length * share))
      if (text) events.push({ type: 'synthesis_token', delta: text })
      if (share === 1) events.push({ type: 'synthesis_done', text: data.plan })
    }
    episode = events.reduce(episodeReducer, initialEpisode())
  }

  return {
    t,
    scene,
    stage,
    score: snapshot.total_score,
    scores: snapshot.scores,
    cursor: scene === 'ask' ? [...CURSOR_MOVES].reverse().find(([at]) => t >= at)![1] : null,
    picking: scene === 'ask' && t >= PICK_AT,
    evolved: t >= EVOLVED_AT,
    episode,
  }
}
