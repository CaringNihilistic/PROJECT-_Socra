import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../chat/__fixtures__/chatSession.json'
import { STAGES } from '../../pixel/cast'
import { useSessionStore, type SessionData } from '../sessionStore'

const [egg, hatchling, , final] = STAGES
const intake = { ...fixture.intake, explanations: fixture.debate.explanations } as unknown as SessionData
const debate = fixture.debate as unknown as SessionData

/** Mock the chat stream endpoint with these SSE payloads. */
function streamReturns(...payloads: object[]) {
  const body = payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`).join('')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
}

const send = () => useSessionStore.getState().sendMessage('an answer')

describe('evolution after a chat turn', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    useSessionStore.getState().clearSession()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('evolves when the saved session crosses a threshold', async () => {
    useSessionStore.setState({ session: intake })
    streamReturns({ type: 'token', delta: 'Good.' }, { type: 'done', session: debate })
    await send()
    expect(useSessionStore.getState().evolution).toEqual({ from: egg, to: hatchling })
    useSessionStore.getState().dismissEvolution()
    expect(useSessionStore.getState().evolution).toBeNull()
  })

  it('does not evolve when the stage stays the same', async () => {
    useSessionStore.setState({ session: debate })
    streamReturns({ type: 'done', session: debate })
    await send()
    expect(useSessionStore.getState().evolution).toBeNull()
  })

  it('evolves into Final Form as soon as the council starts, once', async () => {
    useSessionStore.setState({ session: debate })
    const planned = { ...debate, phase: 'masterplan', masterplan: '# Verdict\nGo.' }
    streamReturns({ type: 'web_research', queries: ['invoice apps market'] }, { type: 'done', session: planned })
    const sending = send()
    await sending
    const { evolution, episode } = useSessionStore.getState()
    expect(evolution).toEqual({ from: hatchling, to: final })
    expect(episode).not.toBeNull()
  })

  it('does not evolve on load, or for a turn the user has left', async () => {
    useSessionStore.setState({ session: intake })
    streamReturns({ type: 'done', session: debate })
    const sending = send()
    useSessionStore.getState().clearSession()
    await sending
    expect(useSessionStore.getState().evolution).toBeNull()
  })
})
