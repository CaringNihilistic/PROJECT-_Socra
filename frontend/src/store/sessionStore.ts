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

export interface DebateRound {
  round: number
  label: string
  bull: string
  bear: string
}

export interface Debate {
  topic: string
  rounds: DebateRound[]
  verdict: string
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

export interface TribunalTurn {
  role: 'user' | 'assistant'
  persona?: string
  content: string
}

export interface TribunalPersonaVerdict {
  name: string
  icon: string
  color: string
  role: string
  pass: boolean
  score: number
  verdict: string
  key_insight: string
}

export interface TribunalVerdicts {
  personas: Record<string, TribunalPersonaVerdict>
  composite_score: number
  passes: number
  total: number
  grade: 'GREENLIT' | 'STRONG' | 'CHALLENGED' | 'REJECTED'
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
  debate?: Debate | null
  explanations: ScoreExplanation[]
  latest_response?: string
  refusal?: string | null
  choices?: string[]
  paid?: boolean
  mode?: string
  tribunal_history?: TribunalTurn[]
  tribunal_verdicts?: TribunalVerdicts | null
  tribunal_paid?: boolean
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
  paymentRequired: boolean
  isUnlocking: boolean
  // Tribunal-specific state
  tribunalStreaming: boolean
  tribunalActivePersona: string | null
  tribunalPersonaStreams: Record<string, string>
  tribunalRound: number
  tribunalPaymentRequired: boolean
  setAuthToken: (token: string | null) => void
  loadSessionHistory: () => Promise<void>
  createSession: (idea: string, mode?: string) => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  sendTribunalMessage: (content: string) => Promise<void>
  updateAssumptionStatus: (index: number, status: Assumption['status']) => Promise<void>
  generatePitchDeck: () => Promise<void>
  generateDebate: () => Promise<void>
  createCheckout: () => Promise<string | null>
  verifyAndUnlock: (checkoutId: string, sessionId: string) => Promise<void>
  createTribunalCheckout: () => Promise<string | null>
  verifyAndUnlockTribunal: (paymentLinkId: string, sessionId: string) => Promise<void>
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
  paymentRequired: false,
  isUnlocking: false,
  tribunalStreaming: false,
  tribunalActivePersona: null,
  tribunalPersonaStreams: {},
  tribunalRound: 1,
  tribunalPaymentRequired: false,

  setAuthToken: (token) => set({ authToken: token }),

  loadSessionHistory: async () => {
    const { authToken } = get()
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

  createSession: async (idea: string, mode = 'standard') => {
    const { authToken } = get()
    set({ isLoading: true, sessionError: null })
    try {
      const { data } = await axios.post<SessionData>(
        `${API_URL}/sessions/`,
        { idea, mode },
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
    const { authToken } = get()
    set({ isLoading: true })
    try {
      const { data } = await axios.get<SessionData>(`${API_URL}/sessions/${sessionId}`, {
        headers: authHeaders(authToken),
      })
      // Restore tribunal round from history length
      const tRound = Math.floor((data.tribunal_history?.length ?? 0) / 4) + 1
      set({ session: data, tribunalRound: tRound })
    } finally {
      set({ isLoading: false })
    }
  },

  sendMessage: async (content: string) => {
    const { session, authToken } = get()
    if (!session) return
    set({ isSending: true, streamingMessage: '', currentChoices: [], currentAgentReports: [], isAnalyzing: false, isResearching: false })

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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
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
            set({ session: updated, streamingMessage: '', currentAgentReports: [], isAnalyzing: false, isResearching: false })
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
    } finally {
      set({ isSending: false, streamingMessage: '', isAnalyzing: false, isResearching: false })
    }
  },

  sendTribunalMessage: async (content: string) => {
    const { session, authToken, tribunalRound } = get()
    if (!session) return

    set({
      tribunalStreaming: true,
      tribunalActivePersona: null,
      tribunalPersonaStreams: {},
    })

    try {
      const response = await fetch(`${API_URL}/sessions/${session.id}/tribunal/message`, {
        method: 'POST',
        headers: authHeaders(authToken),
        body: JSON.stringify({ content }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'persona_token') {
            set((s) => ({
              tribunalActivePersona: payload.persona,
              tribunalPersonaStreams: {
                ...s.tribunalPersonaStreams,
                [payload.persona]: (s.tribunalPersonaStreams[payload.persona] ?? '') + payload.delta,
              },
            }))

          } else if (payload.type === 'persona_done') {
            // Lock in the final content for this persona
            set((s) => ({
              tribunalActivePersona: null,
              tribunalPersonaStreams: {
                ...s.tribunalPersonaStreams,
                [payload.persona]: payload.content,
              },
            }))

          } else if (payload.type === 'round_complete') {
            const updatedHistory: TribunalTurn[] = payload.tribunal_history
            set((s) => ({
              tribunalRound: tribunalRound + 1,
              tribunalPersonaStreams: {},
              session: s.session
                ? { ...s.session, tribunal_history: updatedHistory }
                : null,
            }))

          } else if (payload.type === 'payment_required') {
            // round_complete already fired — history is up to date in session state
            set({ tribunalPaymentRequired: true })

          } else if (payload.type === 'tribunal_verdict') {
            set((s) => ({
              session: s.session
                ? { ...s.session, tribunal_verdicts: payload.verdicts }
                : null,
            }))
          }
        }
      }
    } finally {
      set({ tribunalStreaming: false, tribunalActivePersona: null })
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
        { session_id: session.id, success_url: successUrl, mode: 'standard' },
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

  createTribunalCheckout: async () => {
    const { session, authToken } = get()
    if (!session) return null
    try {
      const successUrl = `${window.location.origin}/?tribunal_sid=${session.id}`
      const { data } = await axios.post<{ checkout_url?: string; already_paid?: boolean }>(
        `${API_URL}/billing/checkout`,
        { session_id: session.id, success_url: successUrl, mode: 'tribunal' },
        { headers: authHeaders(authToken) },
      )
      if (data.already_paid) {
        set({ tribunalPaymentRequired: false })
        return null
      }
      return data.checkout_url ?? null
    } catch {
      return null
    }
  },

  verifyAndUnlock: async (paymentLinkId: string, sessionId: string) => {
    const { authToken } = get()
    set({ isUnlocking: true })
    try {
      await axios.post(
        `${API_URL}/billing/verify`,
        { payment_link_id: paymentLinkId, session_id: sessionId, mode: 'standard' },
        { headers: authHeaders(authToken) },
      )

      const { data } = await axios.get(`${API_URL}/sessions/${sessionId}`, { headers: authHeaders(authToken) })
      set({ session: data, paymentRequired: false })

      const response = await fetch(`${API_URL}/sessions/${sessionId}/unlock`, {
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
            set({ session: updated, streamingMessage: '', currentAgentReports: [], isAnalyzing: false })
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

  verifyAndUnlockTribunal: async (paymentLinkId: string, sessionId: string) => {
    const { authToken } = get()
    set({ isUnlocking: true })
    try {
      await axios.post(
        `${API_URL}/billing/verify`,
        { payment_link_id: paymentLinkId, session_id: sessionId, mode: 'tribunal' },
        { headers: authHeaders(authToken) },
      )

      // Unlock generates verdicts
      const { data } = await axios.post(
        `${API_URL}/sessions/${sessionId}/tribunal/unlock`,
        {},
        { headers: authHeaders(authToken) },
      )

      set((s) => ({
        tribunalPaymentRequired: false,
        session: s.session
          ? { ...s.session, tribunal_paid: true, tribunal_verdicts: data.verdicts }
          : null,
      }))
    } catch { /* silent */ } finally {
      set({ isUnlocking: false })
    }
  },

  generateDebate: async () => {
    const { session, authToken } = get()
    if (!session?.masterplan) return
    try {
      const { data } = await axios.post<Debate>(
        `${API_URL}/sessions/${session.id}/debate`,
        {},
        { headers: authHeaders(authToken) },
      )
      set((s) => ({ session: s.session ? { ...s.session, debate: data } : null }))
    } catch { /* silently fail */ }
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

  clearSession: () => set({
    session: null,
    streamingMessage: '',
    currentChoices: [],
    currentAgentReports: [],
    isAnalyzing: false,
    isResearching: false,
    paymentRequired: false,
    isUnlocking: false,
    tribunalStreaming: false,
    tribunalActivePersona: null,
    tribunalPersonaStreams: {},
    tribunalRound: 1,
    tribunalPaymentRequired: false,
  }),
}))
