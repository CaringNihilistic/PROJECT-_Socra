/**
 * Pure helpers behind the Interrogation screen: which turns are worth showing, what
 * Prof. Socra's dialog says right now, and when the idea evolves.
 * docs/superpowers/specs/2026-09-30-socra-interrogation-design.md
 */
import { STAGES, stageForPhase, type Stage } from '../pixel/cast'

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

/** Drops turns with nothing to read (empty Part 1s, stray markdown). */
export function visibleTurns<T extends Turn>(history: readonly T[]): T[] {
  return history.filter((m) => (m.content?.replace(/[*#\-_>\s]/g, '') ?? '').length > 5)
}

export const FALLBACK_PROMPT = 'Pick an answer below, or write your own.'

export type DialogLine =
  | { kind: 'streaming'; text: string }
  | { kind: 'waiting' }
  | { kind: 'fallback'; text: string }
  | { kind: 'question'; text: string }
  | { kind: 'intro' }

interface DialogInput {
  history: readonly Turn[]
  isSending: boolean
  streaming: string
  choices: readonly string[]
}

/** What Prof. Socra's dialog box shows (spec §2 item 6). */
export function dialogLine({ history, isSending, streaming, choices }: DialogInput): DialogLine {
  if (isSending) return streaming ? { kind: 'streaming', text: streaming } : { kind: 'waiting' }
  const turns = visibleTurns(history)
  const last = turns[turns.length - 1]
  if (last?.role === 'user' && choices.length) return { kind: 'fallback', text: FALLBACK_PROMPT }
  const question = [...turns].reverse().find((m) => m.role === 'assistant')
  return question ? { kind: 'question', text: question.content } : { kind: 'intro' }
}

/** Earlier turns for the LOG: everything except the question the dialog is showing. */
export function logTurns<T extends Turn>(history: readonly T[], line: DialogLine): T[] {
  const turns = visibleTurns(history)
  if (line.kind !== 'question') return turns
  const shown = turns.map((m) => m.role).lastIndexOf('assistant')
  return turns.filter((_, i) => i !== shown)
}

/** The five eval dimensions as stat rows, in eval_bar.py order. */
export const STAT_ROWS = [
  { key: 'problem_clarity', label: 'CLARITY' },
  { key: 'scale_constraints', label: 'SCALE' },
  { key: 'tech_context', label: 'TECH' },
  { key: 'success_definition', label: 'GOAL' },
  { key: 'risk_awareness', label: 'RISK' },
] as const

export type StatKey = (typeof STAT_ROWS)[number]['key']

const FINAL = STAGES[STAGES.length - 1]

/** The idea's stage; a session with a masterplan is Final Form whatever its phase. */
export function stageForSession(session: { phase: string; masterplan?: string | null }): Stage {
  return session.masterplan ? FINAL : stageForPhase(session.phase)
}

export interface Evolution {
  from: Stage
  to: Stage
}

/** An evolution only ever plays forwards. */
export function evolutionFor(before: Stage, after: Stage): Evolution | null {
  return STAGES.indexOf(after) > STAGES.indexOf(before) ? { from: before, to: after } : null
}

/** Evolution into Final Form, played when a turn starts the council. */
export function evolutionToFinal(before: Stage): Evolution | null {
  return evolutionFor(before, FINAL)
}

/** The one-line meaning shown when a stage is reached. */
export const STAGE_MEANING: Record<Stage['phase'], string> = {
  intake: 'Every idea starts as an egg.',
  debate: 'The council can now debate it.',
  stress_test: 'Ready for a stress test.',
  masterplan: 'The council convenes!',
}
