import { useState, useEffect, useRef, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import { useSessionStore } from '../store/sessionStore'
import type { AgentReport } from '../store/sessionStore'
import { EvalBar } from './EvalBar/EvalBar'

const PHASE_STEPS = [
  { key: 'intake',      label: 'Intake',      color: '#8a8578' },
  { key: 'debate',      label: 'Debate',      color: '#f59e0b' },
  { key: 'stress_test', label: 'Stress Test', color: '#e85d26' },
  { key: 'masterplan',  label: 'Masterplan',  color: '#34d399' },
]

const PHASE_COLOR: Record<string, string> = {
  intake: '#8a8578', debate: '#f59e0b', stress_test: '#e85d26', masterplan: '#34d399',
}

const TOTAL_AGENTS = 5

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

function AgentReportCard({ report, isNew }: { report: AgentReport; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-300 ${isNew ? 'fade-up' : ''}`}
      style={{ borderColor: `${report.color}25`, background: `${report.color}06` }}
    >
      <button
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg flex-shrink-0">{report.icon}</span>
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider flex-1 text-left"
          style={{ color: report.color }}>
          {report.title}
        </span>
        <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: `${report.color}60` }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: `${report.color}15` }}>
          <div className="prose prose-invert prose-sm max-w-none
            prose-p:text-ink-400 prose-p:leading-relaxed prose-p:my-1.5
            prose-li:text-ink-400 prose-li:my-0.5
            prose-strong:text-ink-200 prose-ul:my-1">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentReportSkeleton() {
  return (
    <div className="rounded-xl border border-ink-800/40 px-4 py-3 flex items-center gap-3">
      <div className="w-4 h-4 rounded-full border-2 border-ink-700/60 border-t-transparent animate-spin flex-shrink-0" />
      <span className="text-[11px] font-mono text-ink-800">Analyzing...</span>
    </div>
  )
}

export function SessionPage() {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const {
    session, isSending, streamingMessage, currentChoices,
    currentAgentReports, isAnalyzing,
    sendMessage, clearSession,
  } = useSessionStore()

  const handleShare = () => {
    const url = `${window.location.origin}/share/${session?.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.conversation_history.length, isSending, currentAgentReports.length])

  if (!session) return null

  const { scores, total_score, phase, explanations, conversation_history, masterplan, refusal, assumptions, agent_reports } = session

  const phaseColor = PHASE_COLOR[phase] || '#8a8578'
  const phaseIdx = PHASE_STEPS.findIndex(p => p.key === phase)

  // Prefer stored agent_reports (from DB) over in-progress streaming ones
  const displayReports = agent_reports?.length ? agent_reports : currentAgentReports
  const pendingAgentCount = isAnalyzing ? Math.max(0, TOTAL_AGENTS - currentAgentReports.length) : 0

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
    <div className="min-h-screen flex flex-col transition-colors duration-1000"
      style={{
        background: '#080809',
        backgroundImage: `radial-gradient(ellipse at 50% 0%, ${phaseColor}08 0%, transparent 55%)`,
      }}>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-800/50 px-6 relative overflow-hidden"
        style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)' }}>

        <div className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-1000"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${phaseColor}80 30%, ${phaseColor}80 70%, transparent 100%)` }} />

        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 pt-3 pb-2.5">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-600">Socra</span>
            </div>
            <div className="w-px h-3.5 bg-ink-800 flex-shrink-0" />
            <p className="text-[12px] text-ink-600 truncate flex-1 leading-none">{ideaSlug}</p>
            <button
              onClick={clearSession}
              className="flex-shrink-0 text-[11px] font-mono text-ink-700 hover:text-ink-400 border border-ink-800/60 hover:border-ink-700 px-2.5 py-1 rounded-lg transition-all"
            >
              ← new
            </button>
          </div>

          {/* Phase stepper */}
          <div className="flex items-center pb-3">
            {PHASE_STEPS.map((p, i) => {
              const isActive = i === phaseIdx
              const isDone = i < phaseIdx
              return (
                <Fragment key={p.key}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-700"
                      style={{
                        background: isActive ? p.color : isDone ? `${p.color}50` : 'rgba(255,255,255,0.08)',
                        boxShadow: isActive ? `0 0 8px ${p.color}` : 'none',
                      }} />
                    <span className="text-[10px] font-mono tracking-wider transition-colors duration-500"
                      style={{
                        color: isActive ? p.color : isDone ? `${p.color}55` : 'rgba(255,255,255,0.15)',
                      }}>
                      {p.label}
                    </span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <div className="h-px flex-shrink-0 w-8 mx-2.5 transition-all duration-700"
                      style={{ background: isDone ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)' }} />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Eval bar */}
        <EvalBar scores={scores} totalScore={total_score} phase={phase} explanations={explanations} />

        {/* Assumptions */}
        {assumptions.length > 0 && <AssumptionsList assumptions={assumptions} />}

        {/* Multi-agent analysis section */}
        {(displayReports.length > 0 || isAnalyzing) && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">
                Specialist analysis
              </span>
              <div className="flex-1 h-px bg-ink-800/60" />
              <span className="text-[10px] font-mono text-ink-800 tabular-nums">
                {displayReports.length} / {TOTAL_AGENTS}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {displayReports.map((report) => (
                <AgentReportCard
                  key={report.key}
                  report={report}
                  isNew={!agent_reports?.length}
                />
              ))}
              {Array.from({ length: pendingAgentCount }).map((_, i) => (
                <AgentReportSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="text-[11px] font-mono border px-3 py-1 rounded-lg transition-all"
                  style={copied ? {
                    color: '#34d399', borderColor: 'rgba(52,211,153,0.4)',
                  } : {
                    color: 'rgba(52,211,153,0.4)', borderColor: 'rgba(52,211,153,0.15)',
                  }}
                >
                  {copied ? '✓ Copied' : '↗ Share'}
                </button>
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
            <div key={i} className={`flex gap-4 fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #e85d26)',
                      color: '#08070a',
                      boxShadow: '0 2px 10px rgba(245,158,11,0.22)',
                    }}>
                    S
                  </div>
                </div>
              )}
              <div className={msg.role === 'user'
                ? 'max-w-[75%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed text-ink-200'
                : 'flex-1 min-w-0 text-[14px] leading-relaxed'
              }
                style={msg.role === 'user' ? {
                  background: 'rgba(255,255,255,0.055)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold text-ink-400"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    U
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming — conversation or synthesis */}
          {isSending && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #e85d26)',
                    color: '#08070a',
                    boxShadow: streamingMessage ? '0 2px 10px rgba(245,158,11,0.22)' : '0 2px 16px rgba(245,158,11,0.4)',
                  }}>
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
              ) : isAnalyzing ? (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[12px] text-ink-600 font-mono">Synthesizing masterplan</span>
                  {[0, 120, 240].map((delay) => (
                    <div key={delay} className="w-1 h-1 rounded-full bg-emerald-500/60 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }} />
                  ))}
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

        {/* Quick reply choices */}
        {currentChoices.length > 0 && !isSending && !masterplan && (
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-700">Quick reply</span>
            <div className="flex flex-wrap gap-2">
              {currentChoices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(choice)}
                  className="text-[13px] text-ink-400 border border-ink-800/70 hover:border-amber-500/40 hover:text-ink-100 hover:bg-amber-500/5 px-4 py-2 rounded-full transition-all duration-200 text-left"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Refusal notice */}
        {refusal && (
          <div className="px-4 py-3 rounded-xl text-[12px] text-amber-500/70 font-mono leading-relaxed"
            style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
            {refusal}
          </div>
        )}

        {/* Input — always visible; switches to follow-up mode after masterplan */}
        <div className="sticky bottom-6">
          <div className="relative group">
            <div className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: masterplan
                  ? 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(232,93,38,0.1))',
                filter: 'blur(1px)',
              }} />
            <div className="relative rounded-2xl overflow-hidden border transition-colors duration-300"
              style={{
                background: 'rgba(13,12,11,0.97)',
                backdropFilter: 'blur(12px)',
                borderColor: masterplan ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.1)',
              }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={masterplan ? 'Ask a follow-up question…' : 'Reply to Socra…'}
                rows={3}
                disabled={isSending}
                className="w-full bg-transparent px-5 pt-4 pb-3 text-[14px] text-ink-100 placeholder-ink-700 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSend() }}
              />
              <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800/50">
                {masterplan ? (
                  <span className="text-[11px] font-mono" style={{ color: 'rgba(52,211,153,0.35)' }}>
                    Follow-up mode
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-800 font-mono">⌘↵ to send</span>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-25"
                  style={{
                    background: input.trim() && !isSending
                      ? masterplan
                        ? 'linear-gradient(135deg, #34d399, #10b981)'
                        : 'linear-gradient(135deg, #f59e0b, #e85d26)'
                      : 'rgba(40,38,34,0.8)',
                    boxShadow: input.trim() && !isSending
                      ? masterplan ? '0 0 16px rgba(52,211,153,0.2)' : '0 0 16px rgba(245,158,11,0.2)'
                      : 'none',
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
      </div>
    </div>
  )
}
