import { useState } from 'react'
import { STAGES } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { Arrow, PixelButton } from '../../pixel/ui/PixelButton'

/** The page's last word: back to the one idea box (there is no second input). */
export function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section aria-labelledby="cta-title" className="flex flex-col items-center gap-7 text-center">
      <Sprite name={STAGES[0].sprite} size={64} bob />
      <h2 id="cta-title" className="font-pixel text-[22px] leading-snug text-px-screen sm:text-[30px]">READY TO RISK YOUR IDEA?</h2>
      <p className="max-w-xl text-px-soft">Free, no account needed. Every idea starts as an egg.</p>
      <PixelButton size="lg" lift onClick={onStart}>
        START INTERROGATION<Arrow />
      </PixelButton>
    </section>
  )
}

type UpdatesState = 'idle' | 'sending' | 'done'

/** Email sign-up for feature news (the backend's /waitlist list). Small and quiet, above the footer. */
export function GetUpdates({ apiUrl }: { apiUrl: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<UpdatesState>('idle')
  const [error, setError] = useState('')

  const submit = async () => {
    const value = email.trim()
    if (!value.includes('@')) return setError('Please enter a valid email address.')
    setState('sending')
    setError('')
    try {
      const res = await fetch(`${apiUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      if (!res.ok) throw new Error('Request failed')
      setState('done')
    } catch {
      setError('Something went wrong. Please try again.')
      setState('idle')
    }
  }

  return (
    <section id="updates" aria-labelledby="updates-title" className="flex scroll-mt-20 flex-col gap-3 border-t-2 border-px-edge pt-8 md:flex-row md:items-center md:justify-between md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 id="updates-title" className="font-pixel text-[11px] leading-relaxed text-px-muted">GET UPDATES</h2>
        <p className="text-[20px] text-px-muted">An email when new features land. No spam.</p>
      </div>
      <div className="flex flex-col gap-2">
        {state === 'done' ? (
          <p role="status" className="text-[20px] text-px-plan">
            ✓ You’re on the list. We’ll email you when something new lands.
          </p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label htmlFor="updates-email" className="sr-only">Email address</label>
            <input
              id="updates-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="your@email.com"
              disabled={state === 'sending'}
              className="min-h-[44px] min-w-0 flex-1 border-2 border-px-edge bg-px-night px-3 text-[20px] text-px-screen placeholder:text-px-muted transition-colors duration-150 focus:border-px-muted focus:outline focus:outline-[3px] focus:outline-offset-2 focus:outline-px-plan disabled:opacity-50 md:w-72 md:flex-none"
            />
            <PixelButton type="submit" variant="secondary" size="sm" lift className="!min-h-[44px]" disabled={state === 'sending'}>
              {state === 'sending' ? 'SENDING…' : 'NOTIFY ME'}
            </PixelButton>
          </form>
        )}
        {error && <p role="alert" className="text-[20px] text-px-glitch-text">{error}</p>}
      </div>
    </section>
  )
}
