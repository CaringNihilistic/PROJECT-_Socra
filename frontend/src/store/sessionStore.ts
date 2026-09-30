import { create } from 'zustand'
import axios from 'axios'
import { isCouncilEvent, toEpisodeEvent, toEpisodeEvents, type AgentReport } from '../episode/events'
import { readSse } from '../episode/sse'
import { createEpisodeController, type EpisodeController, type EpisodeMode } from '../episode/controller'
import { canReplay, replayEvents } from '../episode/replay'
import type { EpisodeState } from '../episode/reducer'

export type { AgentReport } from '../episode/events'

export interface Scores {
  problem_clarity: number
  scale_constraints: number
  tech_context: number
  success_definition: number
  risk_awareness: number
}

export interface ScoreExplanation {
  dimension: string
  label: string
  weight: string
  score: number
  status_text: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Assumption {
  text: string
  status: 'unknown' | 'validated' | 'disproved'
}

export interface PitchSlide {
  id: string
  title: string
  headline: string
  bullets: string[]
}

export interface PitchDeck {
  slides: PitchSlide[]
}

export interface SessionData {
  id: string
  initial_idea: string
  scores: Scores
  total_score: number
  phase: string
  turn_number: number
  conversation_history: Message[]
  assumptions: Assumption[]
  masterplan: string | null
  agent_reports: AgentReport[]
  pitch_deck?: PitchDeck | null
  explanations: ScoreExplanation[]
  latest_response?: string
  refusal?: string | null
  choices?: string[]
  paid?: boolean
}

export interface SessionSummary {
  id: string
  initial_idea: string
  phase: string
  total_score: number
  has_masterplan: boolean
  created_at: string | null
}

const LS_KEY = 'socra_recent_sessions'
const MAX_LOCAL_SESSIONS = 10

function saveToLocalStorage(summary: SessionSummary) {
  try {
    const existing: SessionSummary[] = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
    const filtered = existing.filter((s) => s.id !== summary.id)
    localStorage.setItem(LS_KEY, JSON.stringify([summary, ...filtered].slice(0, MAX_LOCAL_SESSIONS)))
  } catch { /* ignore */ }
}

function loadFromLocalStorage(): SessionSummary[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function summaryOf(s: SessionData): SessionSummary {
  return {
    id: s.id,
    initial_idea: s.initial_idea,
    phase: s.phase,
    total_score: s.total_score,
    has_masterplan: !!s.masterplan,
    created_at: new Date().toISOString(),
  }
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface SessionStore {
  session: SessionData | null
  sessionHistory: SessionSummary[]
  isLoading: boolean
  isSending: boolean
  streamingMessage: string
  currentChoices: string[]
  sessionError: string | null
  authToken: string | null
  tokenGetter: (() => Promise<string | null>) | null
  isAdmin: boolean
  paymentRequired: boolean
  isUnlocking: boolean
  streamError: 'timeout' | 'network' | null
  savedFlash: boolean
  lastSentMessage: string
  /** The Council episode (live or replay); null when none has run in this view. */
  episode: EpisodeState | null
  /** Whether the full-screen episode overlay is showing. */
  episodeOpen: boolean
  setAuthToken: (token: string | null) => void
  setTokenGetter: (fn: (() => Promise<string | null>) | null) => void
  getFreshToken: () => Promise<string | null>
  loadMe: () => Promise<void>
  loadSessionHistory: () => Promise<void>
  createSession: (idea: string) => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  updateAssumptionStatus: (index: number, status: Assumption['status']) => Promise<void>
  generatePitchDeck: () => Promise<void>
  createCheckout: () => Promise<string | null>
  verifyAndUnlock: (checkoutId: string, sessionId: string) => Promise<void>
  pipelinePreference: 'legacy' | 'langgraph'
  setPipelinePreference: (p: 'legacy' | 'langgraph') => void
  devUnlock: (useLangGraph?: boolean) => Promise<void>
  devRerunMasterplan: (useLangGraph?: boolean) => Promise<void>
  lastPipeline: 'legacy' | 'langgraph'
  devSeedConversation: () => Promise<void>
  skipEpisode: () => void
  closeEpisode: () => void
  replayEpisode: () => void
  retryEpisode: () => Promise<void>
  saveFollowUpEmail: (sessionId: string, email: string) => Promise<void>
  clearSession: () => void
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// The running episode's engine. Module-level: it holds timers, not renderable state.
let controller: EpisodeController | null = null

export const useSessionStore = create<SessionStore>((set, get) => {
  const resetEpisode = () => {
    controller?.dispose()
    controller = null
    return { episode: null, episodeOpen: false }
  }

  /** Start a fresh episode. Live episodes skip straight to results under reduced motion. */
  const startEpisode = (mode: EpisodeMode): EpisodeController => {
    controller?.dispose()
    const c = createEpisodeController({ mode, onChange: (episode) => set({ episode }) })
    controller = c
    const autoSkip = mode === 'live' && prefersReducedMotion()
    set({ episode: c.state, episodeOpen: !autoSkip })
    if (autoSkip) c.skip()
    return c
  }

  const applySession = (updated: SessionData, pipeline?: string) => {
    set({ session: updated, ...(pipeline ? { lastPipeline: pipeline as 'legacy' | 'langgraph' } : {}) })
    saveToLocalStorage(summaryOf(updated))
  }

  /** A stream still finishing after the user left (← new, or another session) must not bring it back. */
  const stillViewing = (sessionId: string) => get().session?.id === sessionId

  /** Stream POST /unlock into a live episode; resolves when the stream ends. */
  const streamUnlock = async (sessionId: string, token: string | null, opts: { langgraph: boolean; force?: boolean }) => {
    const params = new URLSearchParams()
    if (opts.langgraph) params.set('use_langgraph', 'true')
    if (opts.force) params.set('force', 'true')
    const qs = params.toString() ? `?${params}` : ''
    const response = await fetch(`${API_URL}/sessions/${sessionId}/unlock${qs}`, {
      method: 'POST',
      headers: authHeaders(token),
    })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

    // Already generated and not forced: the endpoint answers with the saved session as JSON
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      applySession(await response.json())
      set(resetEpisode())
      return
    }

    const episode = startEpisode('live')
    let sawDone = false
    try {
      await readSse(response.body, (payload) => {
        const p = payload as Record<string, any>
        if (p?.type === 'done') {
          sawDone = true
          if (stillViewing(sessionId)) applySession(p.session, p.pipeline ?? 'legacy')
        }
        toEpisodeEvents(payload).forEach((e) => episode.push(e))
      })
    } finally {
      if (!sawDone) episode.push({ type: 'stream_error' })
    }
  }

  return {
    session: null,
    sessionHistory: [],
    isLoading: false,
    isSending: false,
    streamingMessage: '',
    currentChoices: [],
    sessionError: null,
    authToken: null,
    tokenGetter: null,
    isAdmin: false,
    paymentRequired: false,
    isUnlocking: false,
    streamError: null,
    savedFlash: false,
    lastSentMessage: '',
    episode: null,
    episodeOpen: false,
    lastPipeline: 'legacy' as const,
    pipelinePreference: (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('socra_pipeline') as 'legacy' | 'langgraph') || 'legacy'
      : 'legacy') as 'legacy' | 'langgraph',

    setAuthToken: (token) => set({ authToken: token }),
    setPipelinePreference: (p) => {
      localStorage.setItem('socra_pipeline', p)
      set({ pipelinePreference: p })
    },
    setTokenGetter: (fn) => set({ tokenGetter: fn }),

    // Clerk session tokens are short-lived (~60s). Always fetch a fresh one right
    // before an authenticated request instead of reusing the stale cached token.
    getFreshToken: async () => {
      const { tokenGetter, authToken } = get()
      if (tokenGetter) {
        try {
          const t = await tokenGetter()
          if (t) { set({ authToken: t }); return t }
        } catch { /* fall back to cached token */ }
      }
      return authToken
    },

    loadMe: async () => {
      const token = await get().getFreshToken()
      if (!token) { set({ isAdmin: false }); return }
      try {
        const { data } = await axios.get(`${API_URL}/me`, { headers: authHeaders(token) })
        set({ isAdmin: !!data.is_admin })
      } catch {
        set({ isAdmin: false })
      }
    },

    loadSessionHistory: async () => {
      const authToken = await get().getFreshToken()
      if (authToken) {
        try {
          const { data } = await axios.get<SessionSummary[]>(`${API_URL}/sessions/`, {
            headers: authHeaders(authToken),
          })
          set({ sessionHistory: data })
        } catch { /* ignore — fall through to localStorage */ }
      } else {
        set({ sessionHistory: loadFromLocalStorage() })
      }
    },

    createSession: async (idea: string) => {
      set({ isLoading: true, sessionError: null, paymentRequired: false, streamingMessage: '', isUnlocking: false, ...resetEpisode() })
      const authToken = await get().getFreshToken()
      try {
        const { data } = await axios.post<SessionData>(
          `${API_URL}/sessions/`,
          { idea },
          { headers: authHeaders(authToken) },
        )
        set({ session: data, currentChoices: data.choices ?? [], sessionError: null })
        const summary = summaryOf(data)
        saveToLocalStorage(summary)
        set((s) => ({ sessionHistory: [summary, ...s.sessionHistory.filter((x) => x.id !== data.id)] }))
      } catch (err: any) {
        const detail = err?.response?.data?.detail
        set({ sessionError: detail || 'Failed to start session. Please try again.' })
      } finally {
        set({ isLoading: false })
      }
    },

    resumeSession: async (sessionId: string) => {
      set({ isLoading: true, paymentRequired: false, streamingMessage: '', isUnlocking: false, ...resetEpisode() })
      const authToken = await get().getFreshToken()
      try {
        const { data } = await axios.get<SessionData>(`${API_URL}/sessions/${sessionId}`, {
          headers: authHeaders(authToken),
        })
        set({ session: data })
      } finally {
        set({ isLoading: false })
      }
    },

    sendMessage: async (content: string) => {
      const { session } = get()
      if (!session) return
      const authToken = await get().getFreshToken()
      set({ isSending: true, streamingMessage: '', currentChoices: [], streamError: null, lastSentMessage: content })

      // 20s to the first byte catches a stalled chat. Once bytes flow, allow 60s between
      // chunks: when a turn crosses into the masterplan the server runs web research and
      // all five agents before its next event, which can exceed 20s.
      const FIRST_BYTE_MS = 20000
      const BETWEEN_CHUNKS_MS = 60000
      const abort = new AbortController()
      let timer: ReturnType<typeof setTimeout> | null = null
      let timedOut = false
      const arm = (ms: number) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timedOut = true
          abort.abort()
        }, ms)
      }

      let episode: EpisodeController | null = null
      let sawDone = false
      try {
        arm(FIRST_BYTE_MS)
        const response = await fetch(`${API_URL}/sessions/${session.id}/message/stream`, {
          method: 'POST',
          headers: authHeaders(authToken),
          body: JSON.stringify({ content }),
          signal: abort.signal,
        })
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

        await readSse(
          response.body,
          (payload) => {
            const p = payload as Record<string, any>
            if (p?.type === 'token') {
              set((s) => ({ streamingMessage: s.streamingMessage + p.delta }))
            } else if (p?.type === 'payment_required') {
              set({ paymentRequired: true })
            } else if (p?.type === 'choices') {
              set({ currentChoices: p.choices })
            } else if (p?.type === 'done') {
              sawDone = true
              if (stillViewing(session.id)) {
                applySession(p.session)
                set({ streamingMessage: '', savedFlash: true })
                setTimeout(() => set({ savedFlash: false }), 2000)
              }
            }

            // The turn crossed into the masterplan: the council runs inside this stream.
            // Only a council event starts the episode (every chat turn ends with `done`).
            const first = toEpisodeEvent(payload)
            const events = episode ? toEpisodeEvents(payload) : first && isCouncilEvent(first) ? [first] : []
            if (events.length) {
              if (!episode) {
                episode = startEpisode('live')
                set({ streamingMessage: '' })
              }
              events.forEach((e) => (episode as EpisodeController).push(e))
            }
          },
          () => arm(BETWEEN_CHUNKS_MS),
        )
        if (timedOut) set({ streamError: 'timeout' })
      } catch {
        set({ streamError: timedOut ? 'timeout' : 'network' })
      } finally {
        if (timer) clearTimeout(timer)
        if (episode && !sawDone) (episode as EpisodeController).push({ type: 'stream_error' })
        set({ isSending: false, streamingMessage: '' })
      }
    },

    updateAssumptionStatus: async (index, status) => {
      const { session, authToken } = get()
      if (!session) return
      const updated = session.assumptions.map((a, i) => i === index ? { ...a, status } : a)
      set((s) => ({ session: s.session ? { ...s.session, assumptions: updated } : null }))
      try {
        await axios.patch(
          `${API_URL}/sessions/${session.id}/assumptions`,
          { index, status },
          { headers: authHeaders(authToken) },
        )
      } catch {
        set((s) => ({ session: s.session ? { ...s.session, assumptions: session.assumptions } : null }))
      }
    },

    createCheckout: async () => {
      const { session, authToken } = get()
      if (!session) return null
      try {
        const successUrl = `${window.location.origin}/?sid=${session.id}`
        const { data } = await axios.post<{ checkout_url?: string; already_paid?: boolean }>(
          `${API_URL}/billing/checkout`,
          { session_id: session.id, success_url: successUrl },
          { headers: authHeaders(authToken) },
        )
        if (data.already_paid) {
          set({ paymentRequired: false })
          return null
        }
        return data.checkout_url ?? null
      } catch {
        return null
      }
    },

    verifyAndUnlock: async (paymentLinkId: string, sessionId: string) => {
      set({ isUnlocking: true })
      try {
        const token = await get().getFreshToken()
        await axios.post(
          `${API_URL}/billing/verify`,
          { payment_link_id: paymentLinkId, session_id: sessionId },
          { headers: authHeaders(token) },
        )
        const { data } = await axios.get(`${API_URL}/sessions/${sessionId}`, { headers: authHeaders(token) })
        set({ session: data, paymentRequired: false })
        await streamUnlock(sessionId, token, { langgraph: get().pipelinePreference === 'langgraph' })
      } catch { /* silent */ } finally {
        set({ isUnlocking: false })
      }
    },

    devUnlock: async (useLangGraph = false) => {
      const { session } = get()
      if (!session) return
      set({ isUnlocking: true })
      try {
        const token = await get().getFreshToken()
        await axios.post(`${API_URL}/sessions/${session.id}/admin-mark-paid`, {}, { headers: authHeaders(token) })
        set({ paymentRequired: false })
        await streamUnlock(session.id, token, { langgraph: useLangGraph })
      } catch (err) {
        console.error('[devUnlock] failed:', err)
        alert(`Dev unlock failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        set({ isUnlocking: false })
      }
    },

    devRerunMasterplan: async (useLangGraph = false) => {
      const { session } = get()
      if (!session) return
      set({ isUnlocking: true })
      try {
        const token = await get().getFreshToken()
        await axios.post(`${API_URL}/sessions/${session.id}/admin-mark-paid`, {}, { headers: authHeaders(token) })
        set({ paymentRequired: false })
        await streamUnlock(session.id, token, { langgraph: useLangGraph, force: true })
      } catch (err) {
        console.error('[devRerunMasterplan] failed:', err)
        alert(`Re-run failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        set({ isUnlocking: false })
      }
    },

    devSeedConversation: async () => {
      const { session } = get()
      if (!session) return
      set({ isUnlocking: true, streamingMessage: '' })
      try {
        const token = await get().getFreshToken()
        const { data } = await axios.post(
          `${API_URL}/sessions/${session.id}/admin-seed-conversation`,
          {},
          // Up to 5 chat turns + 5 agents + an 8k-token synthesis + devil's advocate
          { headers: authHeaders(token), timeout: 300000 },
        )
        set({ session: data, paymentRequired: false })
      } catch (err) {
        console.error('[devSeedConversation] failed:', err)
        alert(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        set({ isUnlocking: false })
      }
    },

    skipEpisode: () => {
      controller?.skip()
      set({ episodeOpen: false })
    },

    closeEpisode: () => set({ episodeOpen: false }),

    replayEpisode: () => {
      const { session } = get()
      if (!session || !canReplay(session)) return
      const c = startEpisode('replay')
      replayEvents(session).forEach((e) => c.push(e))
    },

    /** Re-run /unlock after a failed episode. Returns the saved plan if it finished meanwhile. */
    retryEpisode: async () => {
      const { session, isUnlocking } = get()
      if (!session || isUnlocking) return // a double click must not start two paid runs
      set({ isUnlocking: true })
      try {
        const token = await get().getFreshToken()
        await streamUnlock(session.id, token, { langgraph: get().pipelinePreference === 'langgraph' })
      } catch (err) {
        console.error('[retryEpisode] failed:', err)
      } finally {
        set({ isUnlocking: false })
      }
    },

    generatePitchDeck: async () => {
      const { session, authToken } = get()
      if (!session?.masterplan) return
      try {
        const { data } = await axios.post<PitchDeck>(
          `${API_URL}/sessions/${session.id}/pitch-deck`,
          {},
          { headers: authHeaders(authToken) },
        )
        set((s) => ({ session: s.session ? { ...s.session, pitch_deck: data } : null }))
      } catch { /* silently fail */ }
    },

    saveFollowUpEmail: async (sessionId: string, email: string) => {
      const { authToken } = get()
      await fetch(`${API_URL}/sessions/${sessionId}/follow-up`, {
        method: 'POST',
        headers: authHeaders(authToken),
        body: JSON.stringify({ email }),
      })
    },

    clearSession: () => set({
      session: null,
      streamingMessage: '',
      currentChoices: [],
      paymentRequired: false,
      isUnlocking: false,
      streamError: null,
      savedFlash: false,
      lastSentMessage: '',
      ...resetEpisode(),
    }),
  }
})
