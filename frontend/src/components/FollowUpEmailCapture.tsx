import { useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { PixelButton } from '../pixel/ui/PixelButton'
import { PixelPanel } from '../pixel/ui/PixelPanel'

interface Props {
  sessionId: string
}

/** 90-day check-in: we email the founder to ask what actually happened. */
export function FollowUpEmailCapture({ sessionId }: Props) {
  const saveFollowUpEmail = useSessionStore((s) => s.saveFollowUpEmail)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle')
  const valid = email.trim().includes('@')

  const submit = async () => {
    if (!valid || status === 'saving') return
    setStatus('saving')
    try {
      await saveFollowUpEmail(sessionId, email.trim())
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <PixelPanel title="CHECK IN LATER">
      {status === 'done' ? (
        <p role="status" className="text-px-plan">✓ We’ll check in with you in 90 days.</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <p className="text-px-soft">Leave your email and in 90 days we’ll ask what actually happened.</p>
          <div className="flex flex-wrap gap-3">
            <label htmlFor="follow-up-email" className="sr-only">Email address</label>
            <input
              id="follow-up-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === 'failed') setStatus('idle')
              }}
              placeholder="you@example.com"
              disabled={status === 'saving'}
              className="min-w-[220px] flex-1 border-[3px] border-px-edge bg-px-night px-3 py-2 text-[22px] text-px-screen placeholder:text-px-muted focus:border-px-xp focus:outline-none disabled:opacity-50"
            />
            <PixelButton type="submit" disabled={!valid || status === 'saving'}>
              {status === 'saving' ? 'SAVING…' : 'REMIND ME ▶'}
            </PixelButton>
          </div>
          {status === 'failed' && <p role="alert" className="text-px-glitch-text">Couldn’t save that. Please try again.</p>}
        </form>
      )}
    </PixelPanel>
  )
}
