/** One shape for the results view, whether it comes from a saved session or a live episode. */
import { DEVILS_ADVOCATE } from './events'
import type { EpisodeState, GlitchState, Seat } from './reducer'
import { stateFromSession, type SavedCouncil } from './replay'
import type { AgentReport } from './events'

export interface ResultsData {
  seats: Seat[]
  extras: AgentReport[]
  glitch: GlitchState
  plan: string
  planStatus: EpisodeState['plan']['status']
  /** False for legacy sessions saved without council reports. */
  hasCouncil: boolean
  /** True while a skipped live episode is still receiving events. */
  live: boolean
}

function pick(state: EpisodeState, hasCouncil: boolean, live: boolean): ResultsData {
  return {
    seats: state.seats,
    extras: state.extras,
    glitch: state.glitch,
    plan: state.plan.text,
    planStatus: state.plan.status,
    hasCouncil,
    live,
  }
}

export function resultsFromSession(session: SavedCouncil): ResultsData {
  const hasCouncil = (session.agent_reports ?? []).some((r) => r.key !== DEVILS_ADVOCATE)
  return pick(stateFromSession(session), hasCouncil, false)
}

export function resultsFromEpisode(state: EpisodeState): ResultsData {
  return pick(state, true, state.beat !== 'done' && state.beat !== 'failed')
}
