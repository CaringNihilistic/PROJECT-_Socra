import { useState } from 'react'
import { useSessionStore } from '../store/sessionStore'

interface Props {
  sessionId: string
}

export function FollowUpEmailCapture({ sessionId }: Props) {
  const saveFollowUpEmail = useSessionStore((s) => s.saveFollowUpEmail)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) return
    setStatus('saving')
    try {
      await saveFollowUpEmail(sessionId, email.trim())
      setStatus('done')
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 20px',
        background: 'rgba(52,211,153,0.06)',
        border: '1px solid rgba(52,211,153,0.15)',
        borderRadius: '12px',
        marginTop: '16px',
      }}>
        <span style={{ color: '#34d399', fontSize: '16px' }}>✓</span>
        <span style={{ fontSize: '13px', color: '#6a6460' }}>
          We'll check in with you in 90 days.
        </span>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: '20px',
      padding: '18px 20px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px',
    }}>
      <p style={{
        margin: '0 0 4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#4a4640',
      }}>
        90-day check-in
      </p>
      <p style={{
        margin: '0 0 14px',
        fontSize: '13px',
        color: '#6a6460',
        lineHeight: 1.6,
      }}>
        Leave your email and we'll ask what actually happened in 90 days.
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="you@example.com"
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '10px',
            color: '#f5f0e8',
            fontSize: '13px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={status === 'saving' || !email.includes('@')}
          style={{
            padding: '10px 18px',
            background: email.includes('@') ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${email.includes('@') ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '10px',
            color: email.includes('@') ? '#f59e0b' : '#4a4640',
            fontSize: '13px',
            fontWeight: 600,
            cursor: email.includes('@') ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'saving' ? '…' : 'Remind me'}
        </button>
      </div>
    </div>
  )
}
