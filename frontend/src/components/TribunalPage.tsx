import { useEffect, useRef, useState } from 'react'
import { useSessionStore, type TribunalTurn } from '../store/sessionStore'
import { TribunalCard } from './TribunalCard'

const PERSONAS = [
  { key: 'investor',   name: 'The Investor',   icon: '💰', color: '#34d399', role: 'Series A investor' },
  { key: 'customer',   name: 'The Customer',   icon: '👤', color: '#5590e8', role: 'Your first buyer' },
  { key: 'competitor', name: 'The Competitor', icon: '⚔️', color: '#f59e0b', role: 'Best-funded rival' },
] as const

function PersonaColumn({
  personaKey, name, icon, color, role,
  history, streamText, isStreaming, isActive,
}: {
  personaKey: string
  name: string
  icon: string
  color: string
  role: string
  history: TribunalTurn[]
  streamText: string
  isStreaming: boolean
  isActive: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.length, streamText])

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${isActive ? color + '40' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '16px',
      overflow: 'hidden',
      transition: 'border-color 0.3s',
      boxShadow: isActive ? `0 0 20px ${color}15` : 'none',
    }}>
      {/* Persona header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
        display: 'flex', alignItems: 'center', gap: '12px',
        background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)`,
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: `${color}18`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color, letterSpacing: '0.04em' }}>
            {name}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>
            {role}
          </div>
        </div>
        {isActive && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px', alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: color,
                animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '200px',
        maxHeight: '420px',
      }}>
        {history.map((turn, i) => {
          if (turn.role === 'user') {
            return (
              <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '90%' }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '12px 12px 4px 12px',
                  fontSize: '13px', color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.5,
                  fontFamily: "'Instrument Sans', sans-serif",
                }}>
                  {turn.content}
                </div>
              </div>
            )
          }
          if (turn.persona === personaKey) {
            return (
              <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
                <div style={{
                  padding: '10px 14px',
                  background: `${color}10`,
                  border: `1px solid ${color}20`,
                  borderRadius: '4px 12px 12px 12px',
                  fontSize: '13px', color: 'rgba(255,255,255,0.82)',
                  lineHeight: 1.6,
                  fontFamily: "'Instrument Sans', sans-serif",
                }}>
                  {turn.content}
                </div>
              </div>
            )
          }
          return null
        })}

        {/* Streaming text */}
        {isStreaming && isActive && streamText && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
            <div style={{
              padding: '10px 14px',
              background: `${color}10`,
              border: `1px solid ${color}25`,
              borderRadius: '4px 12px 12px 12px',
              fontSize: '13px', color: 'rgba(255,255,255,0.82)',
              lineHeight: 1.6,
              fontFamily: "'Instrument Sans', sans-serif",
            }}>
              {streamText}
              <span style={{ opacity: 0.5, animation: 'blink 1s step-start infinite' }}>▋</span>
            </div>
          </div>
        )}

        {/* Waiting indicator */}
        {isStreaming && !isActive && !streamText && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '4px 12px 12px 12px',
            display: 'flex', gap: '4px', alignItems: 'center',
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export function TribunalPage() {
  const session = useSessionStore((s) => s.session)
  const tribunalStreaming = useSessionStore((s) => s.tribunalStreaming)
  const tribunalActivePersona = useSessionStore((s) => s.tribunalActivePersona)
  const tribunalPersonaStreams = useSessionStore((s) => s.tribunalPersonaStreams)
  const tribunalPaymentRequired = useSessionStore((s) => s.tribunalPaymentRequired)
  const isUnlocking = useSessionStore((s) => s.isUnlocking)
  const sendTribunalMessage = useSessionStore((s) => s.sendTribunalMessage)
  const createTribunalCheckout = useSessionStore((s) => s.createTribunalCheckout)
  const clearSession = useSessionStore((s) => s.clearSession)

  const [input, setInput] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [autoSent, setAutoSent] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const tribunalHistory: TribunalTurn[] = session?.tribunal_history ?? []
  const verdicts = session?.tribunal_verdicts ?? null
  const completedRounds = Math.floor(tribunalHistory.length / 4)

  // Auto-send initial idea on first mount
  useEffect(() => {
    if (!session || autoSent || tribunalHistory.length > 0) return
    setAutoSent(true)
    sendTribunalMessage(session.initial_idea)
  }, [session?.id])

  const canSend = !tribunalStreaming && !tribunalPaymentRequired && !verdicts && completedRounds < 4 && input.trim()

  const handleSend = () => {
    if (!canSend) return
    sendTribunalMessage(input.trim())
    setInput('')
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    const url = await createTribunalCheckout()
    setCheckoutLoading(false)
    if (url) window.location.href = url
  }

  if (!session) return null

  // Show verdict card after verdicts are unlocked
  if (verdicts) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080808',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 20px',
        fontFamily: "'DM Mono', monospace",
      }}>
        <style>{`
          @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); } 40% { transform: scale(1); } }
          @keyframes blink { 50% { opacity: 0; } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        <div style={{ width: '100%', maxWidth: '680px', animation: 'fadeIn 0.6s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Startup Tribunal · Verdict
            </div>
            <h2 style={{ fontSize: '24px', color: 'rgba(255,255,255,0.9)', margin: 0, fontFamily: "'Instrument Sans', sans-serif" }}>
              The jury has reached a decision.
            </h2>
          </div>

          <TribunalCard idea={session.initial_idea} verdicts={verdicts} sessionId={session.id} />

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
            <a
              href={`/card/${session.id}`}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                fontSize: '13px',
                letterSpacing: '0.05em',
              }}
            >
              Share verdict card →
            </a>
            <button
              onClick={clearSession}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              New idea
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Mono', monospace",
    }}>
      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); } 40% { transform: scale(1); } }
        @keyframes blink { 50% { opacity: 0; } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            Startup Tribunal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Round indicator */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1, 2, 3, 4].map((r) => (
              <div key={r} style={{
                width: '24px', height: '4px', borderRadius: '2px',
                background: r <= completedRounds
                  ? '#f59e0b'
                  : r === completedRounds + 1 && tribunalStreaming
                  ? 'rgba(245,158,11,0.4)'
                  : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
            Round {Math.min(completedRounds + 1, 4)} / 4
          </span>

          <button
            onClick={clearSession}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)', fontSize: '12px',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Idea banner */}
      <div style={{
        padding: '12px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
        flexShrink: 0,
      }}>
        <p style={{
          margin: 0, fontSize: '12px',
          color: 'rgba(255,255,255,0.4)', lineHeight: 1.4,
          fontFamily: "'Instrument Sans', sans-serif",
          fontStyle: 'italic',
        }}>
          "{session.initial_idea.length > 160 ? session.initial_idea.slice(0, 157) + '…' : session.initial_idea}"
        </p>
      </div>

      {/* Persona columns */}
      <div style={{
        flex: 1,
        padding: '24px 24px 0',
        display: 'flex',
        gap: '16px',
        overflow: 'hidden',
      }}>
        {PERSONAS.map((p) => {
          const colHistory = tribunalHistory.filter(
            (t) => t.role === 'user' || t.persona === p.key
          )
          const streamText = tribunalPersonaStreams[p.key] ?? ''
          const isActive = tribunalActivePersona === p.key

          return (
            <PersonaColumn
              key={p.key}
              personaKey={p.key}
              name={p.name}
              icon={p.icon}
              color={p.color}
              role={p.role}
              history={colHistory}
              streamText={streamText}
              isStreaming={tribunalStreaming}
              isActive={isActive}
            />
          )
        })}
      </div>

      {/* Payment gate overlay */}
      {tribunalPaymentRequired && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,8,8,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            maxWidth: '440px', width: '100%',
            padding: '48px 40px',
            background: 'linear-gradient(145deg, #0f0e0d, #0a0a12)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(245,158,11,0.08)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚖️</div>
            <h3 style={{
              fontSize: '20px', color: 'rgba(255,255,255,0.92)',
              margin: '0 0 12px',
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: 600,
            }}>
              4 rounds complete.
            </h3>
            <p style={{
              fontSize: '14px', color: 'rgba(255,255,255,0.45)',
              margin: '0 0 32px', lineHeight: 1.6,
            }}>
              The tribunal has deliberated. Unlock the Pass/Fail verdicts from all three judges — plus the shareable card founders post on LinkedIn.
            </p>

            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'center',
              gap: '6px', marginBottom: '28px',
            }}>
              <span style={{ fontSize: '40px', fontWeight: 700, color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>
                ₹199
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>one-time</span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              style={{
                width: '100%', padding: '16px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none', borderRadius: '12px',
                color: '#000', fontSize: '14px', fontWeight: 700,
                cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
                opacity: checkoutLoading ? 0.7 : 1,
              }}
            >
              {checkoutLoading ? 'Redirecting…' : 'Unlock Verdict →'}
            </button>

            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '16px', lineHeight: 1.5 }}>
              Secure payment via Razorpay. Instant unlock after payment.
            </p>
          </div>
        </div>
      )}

      {/* Unlocking overlay */}
      {isUnlocking && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,8,8,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '16px' }}>⚖️</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', letterSpacing: '0.1em' }}>
              The tribunal deliberates…
            </p>
          </div>
        </div>
      )}

      {/* Input area */}
      {!tribunalPaymentRequired && !verdicts && (
        <div style={{
          padding: '16px 24px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}>
          {completedRounds === 0 && tribunalStreaming && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginBottom: '12px' }}>
              The tribunal is reviewing your idea…
            </p>
          )}
          {completedRounds > 0 && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
              Round {completedRounds + 1} of 4 — respond to the panel
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', maxWidth: '900px', margin: '0 auto' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={
                tribunalStreaming ? 'Waiting for the panel…' :
                completedRounds === 0 ? 'The tribunal will begin shortly…' :
                'Your response to all three judges…'
              }
              disabled={!canSend && !tribunalStreaming}
              rows={2}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                fontFamily: "'Instrument Sans', sans-serif",
                lineHeight: 1.5,
                transition: 'border-color 0.2s',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                padding: '14px 20px',
                background: canSend
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: '12px',
                color: canSend ? '#000' : 'rgba(255,255,255,0.2)',
                cursor: canSend ? 'pointer' : 'not-allowed',
                fontSize: '18px',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
