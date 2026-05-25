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
  setAuthToken: (token: string | null) => void
  loadSessionHistory: () => Promise<void>
  createSession: (idea: string) => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  updateAssumptionStatus: (index: number, status: Assumption['status']) => Promise<void>
  generatePitchDeck: () => Promise<void>
  generateDebate: () => Promise<void>
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

  createSession: async (idea: string) => {
    const { authToken } = get()
    set({ isLoading: true, sessionError: null })
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
    set({ isLoading: true })
    try {
      const { data } = await axios.get<SessionData>(`${API_URL}/sessions/${sessionId}`)
      set({ session: data })
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

          } else if (payload.type === 'choices') {
            set({ currentChoices: payload.choices })

          } else if (payload.type === 'web_research') {
            set({ isResearching: true })

          } else if (payload.type === 'agent_report') {
            // First report signals we've entered the analysis phase
            set((s) => ({
              isAnalyzing: true,
              isResearching: false,
              streamingMessage: '',
              currentAgentReports: [...s.currentAgentReports, payload.report],
            }))

          } else if (payload.type === 'synthesis_token') {
            // Synthesis streams like a normal message
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

  updateAssumptionStatus: async (index, status) => {
    const { session, authToken } = get()
    if (!session) return
    // Optimistic update
    const updated = session.assumptions.map((a, i) => i === index ? { ...a, status } : a)
    set((s) => ({ session: s.session ? { ...s.session, assumptions: updated } : null }))
    try {
      await axios.patch(
        `${API_URL}/sessions/${session.id}/assumptions`,
        { index, status },
        { headers: authHeaders(authToken) },
      )
    } catch {
      // Roll back
      set((s) => ({ session: s.session ? { ...s.session, assumptions: session.assumptions } : null }))
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
    } catch { /* silently fail — pitch deck is optional */ }
  },

  clearSession: () => set({
    session: null,
    streamingMessage: '',
    currentChoices: [],
    currentAgentReports: [],
    isAnalyzing: false,
    isResearching: false,
  }),
}))
