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

export interface SessionData {
  id: string
  initial_idea: string
  scores: Scores
  total_score: number
  phase: string
  turn_number: number
  conversation_history: Message[]
  assumptions: string[]
  masterplan: string | null
  explanations: ScoreExplanation[]
  latest_response?: string
  refusal?: string | null
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
  authToken: string | null
  setAuthToken: (token: string | null) => void
  loadSessionHistory: () => Promise<void>
  createSession: (idea: string) => Promise<void>
  resumeSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
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
  authToken: null,

  setAuthToken: (token) => set({ authToken: token }),

  loadSessionHistory: async () => {
    const { authToken } = get()
    if (authToken) {
      // Signed-in: load from backend
      try {
        const { data } = await axios.get<SessionSummary[]>(`${API_URL}/sessions/`, {
          headers: authHeaders(authToken),
        })
        set({ sessionHistory: data })
      } catch { /* ignore — fall through to localStorage */ }
    } else {
      // Anonymous: load from localStorage
      set({ sessionHistory: loadFromLocalStorage() })
    }
  },

  createSession: async (idea: string) => {
    const { authToken } = get()
    set({ isLoading: true })
    try {
      const { data } = await axios.post<SessionData>(
        `${API_URL}/sessions/`,
        { idea },
        { headers: authHeaders(authToken) },
      )
      set({ session: data })
      // Persist summary for history
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
    set({ isSending: true, streamingMessage: '' })

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
          } else if (payload.type === 'done') {
            const updated: SessionData = payload.session
            set({ session: updated, streamingMessage: '' })
            // Keep localStorage summary current
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
      set({ isSending: false, streamingMessage: '' })
    }
  },

  clearSession: () => set({ session: null, streamingMessage: '' }),
}))
