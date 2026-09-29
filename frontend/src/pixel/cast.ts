/**
 * The Socra cast and how it maps onto real backend data (agent keys, phases,
 * masterplan headings). Frontend-only: the backend does not know about any of this.
 */
import type { SpriteName } from './sprites'

export type CreatureType = 'steel' | 'psychic' | 'fighting' | 'electric' | 'ghost'

export interface Character {
  name: string
  sprite: SpriteName
  role: string
  line: string
}

export interface Creature extends Character {
  type: CreatureType
  advisor: string
}

export const PROFESSOR: Character = {
  name: 'Prof. Socra',
  sprite: 'socra',
  role: 'The interrogator',
  line: 'No masterplan until I understand you.',
}

// Keyed by the backend agent `key` in llm_client.COUNCIL_SEATS
export const COUNCIL = {
  finance: { name: 'Coinbit', sprite: 'coinbit', type: 'steel', advisor: 'The Banker', role: 'Finance', line: 'Show me the unit economics.' },
  market: { name: 'Augurin', sprite: 'augurin', type: 'psychic', advisor: 'The Oracle', role: 'Market', line: 'I’ve seen your market… it’s smaller.' },
  competition: { name: 'Rivalix', sprite: 'rivalix', type: 'fighting', advisor: 'The Challenger', role: 'Competition', line: 'Rivals incoming!' },
  tech: { name: 'Beavolt', sprite: 'beavolt', type: 'electric', advisor: 'The Builder', role: 'Tech', line: 'Let’s see what breaks at 10×.' },
  risk: { name: 'Omenyx', sprite: 'omenyx', type: 'ghost', advisor: 'The Skeptic', role: 'Risk', line: 'Every plan has a crack. Found it.' },
} as const satisfies Record<string, Creature>

export type CouncilKey = keyof typeof COUNCIL

export const TEAM_GLITCH = {
  name: 'Team Glitch',
  motto: 'Your plan looks shiny? Prepare for a glitch!',
  members: [
    { name: 'Hex', sprite: 'hex', role: 'Commander', line: 'Reads the plan through a glitch visor.' },
    { name: 'Rook', sprite: 'rook', role: 'Saboteur', line: 'Finds the weakest assumption.' },
    { name: 'Gremlix', sprite: 'gremlix', role: 'Their gremlin', line: 'Chews through fragile plans.' },
  ] satisfies Character[],
}

export const TRAINERS = {
  kai: { name: 'Kai', sprite: 'kai', role: 'Bold rookie', line: 'Presents the Verdict and the phase plan.' },
  dex: { name: 'Dex', sprite: 'dex', role: 'Steady planner', line: 'Presents the Tech Stack and costs.' },
  marin: { name: 'Marin', sprite: 'marin', role: 'Water-type gym leader', line: 'Presents the Risk Register.' },
} as const satisfies Record<string, Character>

export interface Stage {
  phase: 'intake' | 'debate' | 'stress_test' | 'masterplan'
  name: string
  sprite: SpriteName
  /** Minimum total score (0–1), mirroring backend eval_bar.PHASE_THRESHOLDS */
  threshold: number
}

export const STAGES: readonly Stage[] = [
  { phase: 'intake', name: 'Idea Egg', sprite: 'egg', threshold: 0 },
  { phase: 'debate', name: 'Hatchling', sprite: 'hatchling', threshold: 0.4 },
  { phase: 'stress_test', name: 'Evolved', sprite: 'evolved', threshold: 0.7 },
  { phase: 'masterplan', name: 'Final Form', sprite: 'final', threshold: 0.8 },
]

export type CouncilMember =
  | { kind: 'creature'; creature: Creature }
  | { kind: 'glitch'; team: typeof TEAM_GLITCH }

/**
 * The cast member for a backend agent report. Unknown keys return null so a renamed
 * agent shows a neutral card rather than the wrong creature.
 */
export function councilForAgentKey(key: string): CouncilMember | null {
  if (key === 'devils_advocate') return { kind: 'glitch', team: TEAM_GLITCH }
  if (Object.prototype.hasOwnProperty.call(COUNCIL, key)) {
    return { kind: 'creature', creature: COUNCIL[key as CouncilKey] }
  }
  return null
}

/** Evolution stage for a backend `phase`; anything unknown is still an egg. */
export function stageForPhase(phase: string): Stage {
  return STAGES.find((s) => s.phase === phase) ?? STAGES[0]
}

/** Highest stage whose threshold the score has reached. */
export function stageForScore(score: number): Stage {
  return [...STAGES].reverse().find((s) => score >= s.threshold) ?? STAGES[0]
}

/** The stage after this one, or null at Final Form. */
export function nextStage(stage: Stage): Stage | null {
  return STAGES[STAGES.indexOf(stage) + 1] ?? null
}

/**
 * Which trainer presents a masterplan section, by its heading. Checked in the order
 * Marin → Dex → Kai so "Risk Register" never falls through to Kai.
 */
export function trainerForHeading(heading: string): Character {
  const h = heading.toLowerCase()
  if (h.includes('risk')) return TRAINERS.marin
  if (h.includes('tech stack') || h.includes('files') || h.includes('cost')) return TRAINERS.dex
  return TRAINERS.kai
}
