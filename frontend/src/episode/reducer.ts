/** Pure episode state machine: (state, event) → state. */
import { COUNCIL, type CouncilKey } from '../pixel/cast'
import { DEVILS_ADVOCATE, type AgentReport, type EpisodeEvent } from './events'
import { isFainted, signatureLine } from './signature'

export type Beat = 'scouting' | 'council' | 'plan' | 'ambush' | 'done' | 'failed'
export type SeatStatus = 'thinking' | 'done' | 'fainted'

export interface Seat {
  key: CouncilKey
  status: SeatStatus
  signature: string | null
  report: AgentReport | null
}

export interface GlitchState {
  status: 'waiting' | 'done' | 'fainted' | 'absent'
  signature: string | null
  report: AgentReport | null
}

export interface EpisodeState {
  beat: Beat
  queries: string[]
  /** Always the five council seats, in COUNCIL order. */
  seats: Seat[]
  /** Reports with keys the frontend doesn't know: shown as neutral cards. */
  extras: AgentReport[]
  plan: { text: string; status: 'waiting' | 'writing' | 'done' | 'failed' }
  glitch: GlitchState
  skipped: boolean
}

export const COUNCIL_KEYS = Object.keys(COUNCIL) as CouncilKey[]

export function initialEpisode(): EpisodeState {
  return {
    beat: 'scouting',
    queries: [],
    seats: COUNCIL_KEYS.map((key) => ({ key, status: 'thinking', signature: null, report: null })),
    extras: [],
    plan: { text: '', status: 'waiting' },
    glitch: { status: 'waiting', signature: null, report: null },
    skipped: false,
  }
}

const EARLY: Beat[] = ['scouting', 'council']
const FINISHED: Beat[] = ['done', 'failed']

function isCouncilKey(key: string): key is CouncilKey {
  return (COUNCIL_KEYS as string[]).includes(key)
}

export function episodeReducer(state: EpisodeState, event: EpisodeEvent): EpisodeState {
  if (state.beat === 'done' && event.type !== 'done') return state

  switch (event.type) {
    case 'web_research':
      return { ...state, queries: event.queries }

    case 'agent_report': {
      const { report } = event
      const fainted = isFainted(report.content)
      const signature = fainted ? null : signatureLine(report.content)
      if (report.key === DEVILS_ADVOCATE) {
        return {
          ...state,
          beat: FINISHED.includes(state.beat) ? state.beat : 'ambush',
          glitch: { status: fainted ? 'fainted' : 'done', signature, report },
        }
      }
      const beat = state.beat === 'scouting' ? 'council' : state.beat
      if (!isCouncilKey(report.key)) {
        return { ...state, beat, extras: [...state.extras, report] }
      }
      return {
        ...state,
        beat,
        seats: state.seats.map((s) =>
          s.key === report.key ? { ...s, status: fainted ? 'fainted' : 'done', signature, report } : s,
        ),
      }
    }

    case 'synthesis_token':
      return {
        ...state,
        beat: EARLY.includes(state.beat) ? 'plan' : state.beat,
        plan: { text: state.plan.text + event.delta, status: 'writing' },
      }

    case 'synthesis_done':
      return {
        ...state,
        beat: EARLY.includes(state.beat) ? 'plan' : state.beat,
        plan: { text: event.text, status: event.text.trim() ? 'done' : 'failed' },
      }

    case 'done':
      return {
        ...state,
        beat: 'done',
        plan:
          state.plan.status === 'writing' || state.plan.status === 'waiting'
            ? { ...state.plan, status: state.plan.text.trim() ? 'done' : 'failed' }
            : state.plan,
        seats: state.seats.map((s) => (s.status === 'thinking' ? { ...s, status: 'fainted' } : s)),
        glitch: state.glitch.status === 'waiting' ? { ...state.glitch, status: 'absent' } : state.glitch,
      }

    case 'stream_error':
      return { ...state, beat: 'failed' }
  }
}
