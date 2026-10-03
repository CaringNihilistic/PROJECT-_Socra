import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { needsOpening, useSessionStore, type SessionData } from '../sessionStore'

const IDEA = 'A mobile app that tracks grocery prices across local stores using receipt scanning'
const fresh = {
  id: 's1', initial_idea: IDEA, scores: {}, total_score: 0, phase: 'intake', turn_number: 0,
  conversation_history: [{ role: 'user', content: IDEA }], assumptions: [], masterplan: null,
  agent_reports: [], explanations: [], choices: [],
} as unknown as SessionData
const opened = {
  ...fresh, turn_number: 1,
  conversation_history: [...fresh.conversation_history, { role: 'assistant', content: 'Who **exactly** pays?' }],
} as SessionData

/** The /start/stream (or /message/stream) SSE response: a token, choices, then done. */
function streamReturns(session: SessionData) {
  const body = [
    { type: 'token', delta: 'Who **exactly** pays?' },
    { type: 'choices', choices: ['Families', 'Students'] },
    { type: 'done', session },
  ].map((p) => `data: ${JSON.stringify(p)}\n\n`).join('')
  const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('the opening question is streamed', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => {
    useSessionStore.getState().clearSession()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('needsOpening: only a fresh session without a question or a plan', () => {
    expect(needsOpening(fresh)).toBe(true)
    expect(needsOpening(opened)).toBe(false)
    expect(needsOpening({ ...fresh, masterplan: '# plan' } as SessionData)).toBe(false)
  })

  it('createSession shows the chat at once, then streams the question from /start/stream', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: fresh })
    const fetchMock = streamReturns(opened)
    await useSessionStore.getState().createSession(IDEA)

    expect(post.mock.calls[0][0]).toMatch(/\/sessions\/\?stream=true$/)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/sessions\/s1\/start\/stream$/)
    expect(init.body).toBe('{}')
    const s = useSessionStore.getState()
    const history = s.session?.conversation_history ?? []
    expect(history[history.length - 1]?.content).toBe('Who **exactly** pays?')
    expect(s.currentChoices).toEqual(['Families', 'Students'])
    expect(s.isLoading).toBe(false)
    expect(s.lastSentMessage).toBe('') // no "YOU" bubble for the opening
  })

  it('a resumed session whose opening never arrived gets it', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: fresh })
    const fetchMock = streamReturns(opened)
    await useSessionStore.getState().resumeSession('s1')
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/start\/stream$/)
  })

  it('a session that already has its question is not re-opened', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: opened })
    const fetchMock = streamReturns(opened)
    await useSessionStore.getState().resumeSession('s1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a failed opening can be retried with startOpening', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: fresh })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await useSessionStore.getState().createSession(IDEA)
    expect(useSessionStore.getState().streamError).toBe('network')

    const fetchMock = streamReturns(opened)
    await useSessionStore.getState().startOpening()
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/start\/stream$/)
    expect(useSessionStore.getState().streamError).toBeNull()
    expect(useSessionStore.getState().session?.conversation_history).toHaveLength(2)
  })
})
