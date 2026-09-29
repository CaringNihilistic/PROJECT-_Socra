/** Rebuild an episode's event stream from a saved session, for replays and results. */
import { DEVILS_ADVOCATE, type AgentReport, type EpisodeEvent } from './events'
import { episodeReducer, initialEpisode, type EpisodeState } from './reducer'

export interface SavedCouncil {
  agent_reports?: AgentReport[] | null
  masterplan?: string | null
}

/** How many chunks the plan is replayed in: at 30ms apart, about 12s. */
export const REPLAY_PLAN_CHUNKS = 400

export function replayEvents(session: SavedCouncil, chunks = REPLAY_PLAN_CHUNKS): EpisodeEvent[] {
  const reports = session.agent_reports ?? []
  const council = reports.filter((r) => r.key !== DEVILS_ADVOCATE)
  const devil = reports.find((r) => r.key === DEVILS_ADVOCATE)
  const plan = session.masterplan ?? ''

  // Split by code point so an emoji is never cut in half mid-replay
  const chars = Array.from(plan)
  const size = Math.max(1, Math.ceil(chars.length / chunks))
  const tokens: EpisodeEvent[] = []
  for (let i = 0; i < chars.length; i += size) {
    tokens.push({ type: 'synthesis_token', delta: chars.slice(i, i + size).join('') })
  }

  return [
    ...council.map((report): EpisodeEvent => ({ type: 'agent_report', report })),
    ...tokens,
    { type: 'synthesis_done', text: plan },
    ...(devil ? [{ type: 'agent_report', report: devil } as EpisodeEvent] : []),
    { type: 'done' },
  ]
}

/** A replay needs at least one council report and a plan. */
export function canReplay(session: SavedCouncil): boolean {
  return Boolean(session.masterplan && (session.agent_reports ?? []).some((r) => r.key !== DEVILS_ADVOCATE))
}

/** The final episode state a saved session represents (no pacing). */
export function stateFromSession(session: SavedCouncil): EpisodeState {
  return replayEvents(session, 1).reduce(episodeReducer, initialEpisode())
}
