import { create } from 'zustand'
import axios from 'axios'

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

export interface AgentReport {
  key: string
  title: string
  icon: string
  color: string
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

interface SessionStore {
  session: SessionData | null
  sessionHistory: SessionSummary[]
  isLoading: boolean
  isSending: boolean
  streamingMessage: string
  currentChoices: string[]
  currentAgentReports: AgentReport[]
  isAnalyzing: boolean
  isResearching: boolean
  sessionError: string | null
  authToken: string | null
  tokenGetter: (() => Promise<string | null>) | null
  isAdmin: boolean
  paymentRequired: boolean
  isUnlocking: boolean
  streamError: 'timeout' | 'network' | null
  savedFlash: boolean
  lastSentMessage: string
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
  saveFollowUpEmail: (sessionId: string, email: string) => Promise<void>
  clearSession: () => void
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  sessionHistory: [],
  isLoading: false,
  isSending: false,
  streamingMessage: '',
  currentChoices: [],
  currentAgentReports: [],
  isAnalyzing: false,
  isResearching: false,
  sessionError: null,
  authToken: null,
  tokenGetter: null,
  isAdmin: false,
  paymentRequired: false,
  isUnlocking: false,
  streamError: null,
  savedFlash: false,
  lastSentMessage: '',
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
    set({ isLoading: true, sessionError: null, paymentRequired: false, streamingMessage: '', currentAgentReports: [], isAnalyzing: false, isUnlocking: false })
    const authToken = await get().getFreshToken()
    try {
      const { data } = await axios.post<SessionData>(
        `${API_URL}/sessions/`,
        { idea },
        { headers: authHeaders(authToken) },
      )
      set({ session: data, currentChoices: data.choices ?? [], sessionError: null })
      const summary: SessionSummary = {
        id: data.id,
        initial_idea: data.initial_idea,
        phase: data.phase,
        total_score: data.total_score,
        has_masterplan: !!data.masterplan,
        created_at: new Date().toISOString(),
      }
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
    set({ isLoading: true, paymentRequired: false, streamingMessage: '', currentAgentReports: [], isAnalyzing: false, isResearching: false, isUnlocking: false })
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
    set({ isSending: true, streamingMessage: '', currentChoices: [], currentAgentReports: [], isAnalyzing: false, isResearching: false, streamError: null, lastSentMessage: content })

    const TOKEN_TIMEOUT_MS = 20000
    let tokenTimer: ReturnType<typeof setTimeout> | null = null
    let timedOut = false

    const resetTimer = (reader: ReadableStreamDefaultReader) => {
      if (tokenTimer) clearTimeout(tokenTimer)
      tokenTimer = setTimeout(() => {
        timedOut = true
        reader.cancel()
      }, TOKEN_TIMEOUT_MS)
    }

    try {
      const response = await fetch(`${API_URL}/sessions/${session.id}/message/stream`, {
        method: 'POST',
        headers: authHeaders(authToken),
        body: JSON.stringify({ content }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      resetTimer(reader)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        resetTimer(reader)
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'token') {
            set((s) => ({ streamingMessage: s.streamingMessage + payload.delta }))

          } else if (payload.type === 'payment_required') {
            set({ paymentRequired: true })

          } else if (payload.type === 'choices') {
            set({ currentChoices: payload.choices })

          } else if (payload.type === 'web_research') {
            set({ isResearching: true })

          } else if (payload.type === 'agent_report') {
            set((s) => ({
              isAnalyzing: true,
              isResearching: false,
              streamingMessage: '',
              currentAgentReports: [...s.currentAgentReports, payload.report],
            }))

          } else if (payload.type === 'synthesis_token') {
            set((s) => ({ streamingMessage: s.streamingMessage + payload.delta }))

          } else if (payload.type === 'done') {
            const updated: SessionData = payload.session
            set({ session: updated, streamingMessage: '', currentAgentReports: [], isAnalyzing: false, isResearching: false, savedFlash: true })
            setTimeout(() => set({ savedFlash: false }), 2000)
            saveToLocalStorage({
              id: updated.id,
              initial_idea: updated.initial_idea,
              phase: updated.phase,
              total_score: updated.total_score,
              has_masterplan: !!updated.masterplan,
              created_at: new Date().toISOString(),
            })
          }
        }
      }

      if (timedOut) set({ streamError: 'timeout' })
    } catch {
      if (timedOut) set({ streamError: 'timeout' })
      else set({ streamError: 'network' })
    } finally {
      if (tokenTimer) clearTimeout(tokenTimer)
      set({ isSending: false, streamingMessage: '', isAnalyzing: false, isResearching: false })
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
    const { authToken, pipelinePreference } = get()
    set({ isUnlocking: true })
    try {
      await axios.post(
        `${API_URL}/billing/verify`,
        { payment_link_id: paymentLinkId, session_id: sessionId },
        { headers: authHeaders(authToken) },
      )

      const { data } = await axios.get(`${API_URL}/sessions/${sessionId}`, { headers: authHeaders(authToken) })
      set({ session: data, paymentRequired: false })

      const qs = pipelinePreference === 'langgraph' ? '?use_langgraph=true' : ''
      const response = await fetch(`${API_URL}/sessions/${sessionId}/unlock${qs}`, {
        method: 'POST',
        headers: authHeaders(authToken),
      })
      if (!response.ok || !response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      set({ isAnalyzing: true, streamingMessage: '', currentAgentReports: [] })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.type === 'agent_report') {
            set((s) => ({
              isAnalyzing: true,
              currentAgentReports: [...s.currentAgentReports, payload.report],
            }))
          } else if (payload.type === 'synthesis_token') {
            set((s) => ({ streamingMessage: s.streamingMessage + payload.delta }))
          } else if (payload.type === 'done') {
            const updated = payload.session
            set({
              session: updated,
              streamingMessage: '',
              currentAgentReports: [],
              isAnalyzing: false,
              lastPipeline: (payload.pipeline ?? 'legacy') as 'legacy' | 'langgraph',
            })
            saveToLocalStorage({
              id: updated.id,
              initial_idea: updated.initial_idea,
              phase: updated.phase,
              total_score: updated.total_score,
              has_masterplan: !!updated.masterplan,
              created_at: new Date().toISOString(),
            })
          }
        }
      }
    } catch { /* silent */ } finally {
      set({ isUnlocking: false, isAnalyzing: false })
    }
  },

  devUnlock: async (useLangGraph = false) => {
    const { session } = get()
    if (!session) return
    set({ isUnlocking: true })
    try {
      const token = await get().getFreshToken()
      await axios.post(`${API_URL}/sessions/${session.id}/admin-mark-paid`, {}, {
        headers: authHeaders(token),
      })
      set({ paymentRequired: false })

      const qs = useLangGraph ? '?use_langgraph=true' : ''
      const response = await fetch(`${API_URL}/sessions/${session.id}/unlock${qs}`, {
        method: 'POST',
        headers: authHeaders(token),
      })
      if (!response.ok || !response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      set({ isAnalyzing: true, streamingMessage: '', currentAgentReports: [] })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const payload = JSON.parse(part.slice(6))
          if (payload.type === 'agent_report') {
            set((s) => ({ isAnalyzing: true, currentAgentReports: [...s.currentAgentReports, payload.report] }))
          } else if (payload.type === 'synthesis_token') {
            set((s) => ({ streamingMessage: s.streamingMessage + payload.delta }))
          } else if (payload.type === 'done') {
            const updated = payload.session
            set({
              session: updated,
              streamingMessage: '',
              currentAgentReports: [],
              isAnalyzing: false,
              lastPipeline: (payload.pipeline ?? 'legacy') as 'legacy' | 'langgraph',
            })
          }
        }
      }
    } catch (err) {
      console.error('[devUnlock] failed:', err)
      alert(`Dev unlock failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      set({ isUnlocking: false, isAnalyzing: false })
    }
  },

  devRerunMasterplan: async (useLangGraph = false) => {
    const { session } = get()
    if (!session) return
    set({ isUnlocking: true, currentAgentReports: [] })
    try {
      const token = await get().getFreshToken()
      await axios.post(`${API_URL}/sessions/${session.id}/admin-mark-paid`, {}, { headers: authHeaders(token) })
      set({ paymentRequired: false })

      const qs = useLangGraph ? '?use_langgraph=true' : ''
      const response = await fetch(`${API_URL}/sessions/${session.id}/unlock${qs}`, {
        method: 'POST', headers: authHeaders(token),
      })
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      set({ isAnalyzing: true, streamingMessage: '' })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const payload = JSON.parse(part.slice(6))
          if (payload.type === 'agent_report') {
            set((s) => ({ isAnalyzing: true, currentAgentReports: [...s.currentAgentReports, payload.report] }))
          } else if (payload.type === 'synthesis_token') {
            set((s) => ({ streamingMessage: s.streamingMessage + payload.delta }))
          } else if (payload.type === 'done') {
            const updated = payload.session
            set({
              session: updated,
              streamingMessage: '',
              currentAgentReports: [],
              isAnalyzing: false,
              lastPipeline: (payload.pipeline ?? 'legacy') as 'legacy' | 'langgraph',
            })
          }
        }
      }
    } catch (err) {
      console.error('[devRerunMasterplan] failed:', err)
      alert(`Re-run failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      set({ isUnlocking: false, isAnalyzing: false })
    }
  },

  devSeedConversation: async () => {
    const { session } = get()
    if (!session) return
    set({ isUnlocking: true, isAnalyzing: true, currentAgentReports: [], streamingMessage: '' })
    try {
      const token = await get().getFreshToken()
      const { data } = await axios.post(
        `${API_URL}/sessions/${session.id}/admin-seed-conversation`,
        {},
        { headers: authHeaders(token), timeout: 180000 },
      )
      set({ session: data, paymentRequired: false })
    } catch (err) {
      console.error('[devSeedConversation] failed:', err)
      alert(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      set({ isUnlocking: false, isAnalyzing: false })
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
    currentAgentReports: [],
    isAnalyzing: false,
    isResearching: false,
    paymentRequired: false,
    isUnlocking: false,
    streamError: null,
    savedFlash: false,
    lastSentMessage: '',
  }),
}))
