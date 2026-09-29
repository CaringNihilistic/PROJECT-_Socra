/** Reducer + pacer: the one engine behind live episodes, replays and the dev demo. */
import { DEVILS_ADVOCATE, type EpisodeEvent } from './events'
import { createPacer, type GapRule } from './pacer'
import { episodeReducer, initialEpisode, type EpisodeState } from './reducer'

export type EpisodeMode = 'live' | 'replay'

const isCouncilReport = (e: EpisodeEvent) => e.type === 'agent_report' && e.report.key !== DEVILS_ADVOCATE
const isPlan = (e: EpisodeEvent) => e.type === 'synthesis_token' || e.type === 'synthesis_done'

/** Minimum display gaps between beats (spec §3). `tokenGap` differs between live and replay. */
export function gapRule(tokenGap: number): GapRule {
  return (prev, next) => {
    if (!prev) return 0
    if (next.type === 'done') return 600
    if (prev.type === 'web_research') return 1200
    if (isCouncilReport(next) && prev.type === 'agent_report') return 600
    if (isPlan(next) && prev.type === 'agent_report') return 900
    if (next.type === 'agent_report' && next.report.key === DEVILS_ADVOCATE) return 900
    if (isPlan(next) && prev.type === 'synthesis_token') return tokenGap
    return 0
  }
}

export const LIVE_GAPS = gapRule(0)
export const REPLAY_GAPS = gapRule(30)

export interface EpisodeController {
  push(event: EpisodeEvent): void
  skip(): void
  dispose(): void
  readonly state: EpisodeState
}

export function createEpisodeController({
  mode,
  onChange,
}: {
  mode: EpisodeMode
  onChange: (state: EpisodeState) => void
}): EpisodeController {
  let state = initialEpisode()
  const pacer = createPacer({
    gapMs: mode === 'live' ? LIVE_GAPS : REPLAY_GAPS,
    onRelease: (batch) => {
      state = batch.reduce(episodeReducer, state)
      onChange(state)
    },
  })
  return {
    push: (event) => pacer.push(event),
    skip() {
      if (!state.skipped) {
        state = { ...state, skipped: true }
        onChange(state)
      }
      pacer.skip()
    },
    dispose: () => pacer.dispose(),
    get state() {
      return state
    },
  }
}
