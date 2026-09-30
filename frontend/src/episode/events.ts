/**
 * The Council episode's event vocabulary: the subset of the backend's SSE events
 * (POST /sessions/{id}/unlock and /message/stream) that drives the episode.
 */

export interface AgentReport {
  key: string
  title: string
  icon: string
  color: string
  content: string
}

export type EpisodeEvent =
  | { type: 'web_research'; queries: string[] }
  | { type: 'agent_report'; report: AgentReport }
  | { type: 'synthesis_token'; delta: string }
  | { type: 'synthesis_done'; text: string }
  | { type: 'done' }
  /** The stream ended (or failed) without a `done` event. Client-generated. */
  | { type: 'stream_error' }

export const DEVILS_ADVOCATE = 'devils_advocate'

function normaliseReport(r: Record<string, unknown>): AgentReport {
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  return { key: text(r.key), title: text(r.title), icon: text(r.icon), color: text(r.color), content: text(r.content) }
}

/** Narrow a parsed SSE payload to an episode event; null for chat-only events (token, choices…). */
export function toEpisodeEvent(payload: unknown): EpisodeEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  switch (p.type) {
    case 'web_research':
      return { type: 'web_research', queries: Array.isArray(p.queries) ? p.queries.map(String) : [] }
    case 'agent_report':
      if (!p.report || typeof p.report !== 'object') return null
      return { type: 'agent_report', report: normaliseReport(p.report as Record<string, unknown>) }
    case 'synthesis_token':
      return { type: 'synthesis_token', delta: String(p.delta ?? '') }
    case 'synthesis_done':
      return { type: 'synthesis_done', text: String(p.text ?? '') }
    case 'done':
      return { type: 'done' }
    default:
      return null
  }
}

/**
 * All episode events for one payload. The backend keeps `synthesis_done` internal (it
 * only uses it to save the plan), so a `done` payload expands to the saved plan followed
 * by `done`. Use only once an episode is running: every chat turn ends with `done`.
 */
export function toEpisodeEvents(payload: unknown): EpisodeEvent[] {
  const p = payload as { type?: unknown; session?: { masterplan?: unknown } } | null
  if (p?.type === 'done' && p.session && typeof p.session === 'object') {
    const plan = p.session.masterplan
    return [{ type: 'synthesis_done', text: typeof plan === 'string' ? plan : '' }, { type: 'done' }]
  }
  const event = toEpisodeEvent(payload)
  return event ? [event] : []
}

/** True for events that mean the council has started (as opposed to a normal chat turn). */
export function isCouncilEvent(event: EpisodeEvent): boolean {
  return event.type !== 'done' && event.type !== 'stream_error'
}
