import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useSessionStore } from '../store/sessionStore'
import { EvalBar } from './EvalBar/EvalBar'

function AssumptionsList({ assumptions }: { assumptions: string[] }) {
  const [expanded, setExpanded] = useState(true)
  const prevCount = useRef(assumptions.length)

  useEffect(() => {
    if (assumptions.length > prevCount.current) setExpanded(true)
    prevCount.current = assumptions.length
  }, [assumptions.length])

  return (
    <div className="rounded-xl border border-ink-800/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-ink-900/40 transition-colors"
      >
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-600">Assumptions</span>
        <span className="text-[10px] font-mono text-ink-700 bg-ink-800/80 px-1.5 py-0.5 rounded-full tabular-nums">
          {assumptions.length}
        </span>
        <svg className={`w-3 h-3 text-ink-700 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1.5 flex flex-wrap gap-1.5 border-t border-ink-800/50">
          {assumptions.map((assumption, i) => (
            <span key={i}
              className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 bg-ink-900/60 border border-ink-800/50 rounded-full px-3 py-1 leading-none">
              <span className="w-1 h-1 rounded-full bg-amber-400/40 flex-shrink-0" />
              {assumption}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function SessionPage() {
  const [input, setInput] = useState('')
  const { session, isSending, streamingMessage, sendMessage, clearSession } = useSessionStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.conversation_history.length, isSending])

  if (!session) return null

  const { scores, total_score, phase, explanations, conversation_history, masterplan, refusal, assumptions } = session

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return
    setInput('')
    await sendMessage(trimmed)
    textareaRef.current?.focus()
  }

  const ideaSlug = session.initial_idea.length > 52
    ? session.initial_idea.slice(0, 52) + '…'
    : session.initial_idea

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080809' }}>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-800/50 px-6 py-3"
        style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-600">Socra</span>
          </div>
          <div className="w-px h-3.5 bg-ink-800 flex-shrink-0" />
          <p className="text-[12px] text-ink-600 truncate flex-1 leading-none">{ideaSlug}</p>
          <button
            onClick={clearSession}
            className="flex-shrink-0 text-[11px] font-mono text-ink-700 hover:text-ink-400 transition-colors ml-auto"
          >
            ← new
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Eval bar */}
        <EvalBar scores={scores} totalScore={total_score} phase={phase} explanations={explanations} />

        {/* Assumptions */}
        {assumptions.length > 0 && <AssumptionsList assumptions={assumptions} />}

        {/* Masterplan */}
        {masterplan && (
          <div className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'rgba(52,211,153,0.15)', background: 'rgba(52,211,153,0.02)' }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{ borderColor: 'rgba(52,211,153,0.12)', background: 'rgba(52,211,153,0.03)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
                <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-emerald-400/80">
                  Architecture masterplan
                </span>
              </div>
              <button
                onClick={() => {
                  const slug = session.initial_idea.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                  const blob = new Blob([masterplan], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `socra-${slug}.md`; a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-[11px] font-mono text-emerald-500/50 hover:text-emerald-400 border border-emerald-500/15 hover:border-emerald-500/40 px-3 py-1 rounded-lg transition-all"
              >
                ↓ Export .md
              </button>
            </div>
            <div className="px-5 py-5 prose prose-invert prose-sm max-w-none text-ink-400
              prose-headings:text-ink-100 prose-headings:font-display prose-headings:tracking-tight
              prose-strong:text-ink-200 prose-code:text-amber-300 prose-code:bg-ink-900 prose-code:px-1 prose-code:rounded
              prose-li:text-ink-400 prose-p:text-ink-400 prose-table:text-ink-400
              prose-th:text-ink-300 prose-th:font-mono prose-th:text-[11px] prose-th:uppercase prose-th:tracking-wider">
              <ReactMarkdown>{masterplan}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Conversation */}
        <div className="flex flex-col gap-6">
          {conversation_history.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-amber-400"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    S
                  </div>
                </div>
              )}
              <div className={msg.role === 'user'
                ? 'max-w-[75%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed text-ink-200'
                : 'flex-1 min-w-0 text-[14px] leading-relaxed'
              }
                style={msg.role === 'user' ? {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                } : undefined}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert max-w-none text-ink-300
                    prose-headings:text-ink-100 prose-headings:font-display prose-headings:tracking-tight prose-headings:mt-5 prose-headings:mb-2
                    prose-strong:text-ink-100 prose-strong:font-semibold
                    prose-p:text-ink-300 prose-p:leading-relaxed prose-p:my-2
                    prose-li:text-ink-300 prose-li:my-0.5
                    prose-code:text-amber-300 prose-code:text-[13px] prose-code:bg-ink-900/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-blockquote:border-amber-500/30 prose-blockquote:text-ink-500"
                    style={{ fontSize: '14px' }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-ink-500"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    U
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {isSending && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-amber-400"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  S
                </div>
              </div>
              {streamingMessage ? (
                <div className="flex-1 min-w-0">
                  <div className="prose prose-invert max-w-none text-ink-300
                    prose-strong:text-ink-100 prose-p:text-ink-300 prose-p:leading-relaxed prose-p:my-2
                    prose-li:text-ink-300 prose-headings:text-ink-100"
                    style={{ fontSize: '14px' }}>
                    <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                  </div>
                  <span className="inline-block w-[3px] h-4 bg-amber-400/60 animate-pulse rounded-sm ml-0.5 align-middle" />
                </div>
              ) : (
                <div className="flex items-center gap-1 pt-2">
                  {[0, 120, 240].map((delay) => (
                    <div key={delay} className="w-1.5 h-1.5 rounded-full bg-ink-700 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Refusal notice */}
        {refusal && (
          <div className="px-4 py-3 rounded-xl text-[12px] text-amber-500/70 font-mono leading-relaxed"
            style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
            {refusal}
          </div>
        )}

        {/* Input */}
        {!masterplan && (
          <div className="sticky bottom-6">
            <div className="relative group">
              <div className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(232,93,38,0.1))', filter: 'blur(1px)' }} />
              <div className="relative rounded-2xl overflow-hidden border border-ink-800/70 group-focus-within:border-amber-500/25 transition-colors duration-300"
                style={{ background: 'rgba(13,12,11,0.97)', backdropFilter: 'blur(12px)' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply to Socra..."
                  rows={3}
                  disabled={isSending}
                  className="w-full bg-transparent px-5 pt-4 pb-3 text-[14px] text-ink-100 placeholder-ink-700 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSend() }}
                />
                <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800/50">
                  <span className="text-[11px] text-ink-800 font-mono">⌘↵ to send</span>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isSending}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-25"
                    style={{
                      background: input.trim() && !isSending
                        ? 'linear-gradient(135deg, #f59e0b, #e85d26)'
                        : 'rgba(40,38,34,0.8)',
                      boxShadow: input.trim() && !isSending ? '0 0 16px rgba(245,158,11,0.2)' : 'none',
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                      stroke={input.trim() && !isSending ? '#08070a' : '#4a4840'} strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
