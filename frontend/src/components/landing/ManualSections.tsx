import { useState } from 'react'
import { PixelButton } from '../../pixel/ui/PixelButton'

type UpdatesState = 'idle' | 'sending' | 'done'

/** Email sign-up for feature news (the backend's /waitlist list). */
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
    <section id="updates" aria-labelledby="updates-title" className="flex scroll-mt-24 flex-col items-center gap-4 text-center">
      <h2 id="updates-title" className="font-pixel text-sm leading-relaxed text-px-xp">GET UPDATES</h2>
      <p className="text-px-soft">Get an email when new features land.</p>
      {state === 'done' ? (
        <p role="status" className="border-[3px] border-px-plan px-4 py-3 text-px-plan">
          You’re on the list. We’ll email you when something new lands.
        </p>
      ) : (
        <form
          className="flex w-full max-w-lg flex-wrap justify-center gap-3"
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
            className="min-w-[220px] flex-1 border-[3px] border-px-edge bg-px-night px-3 py-2 text-[22px] text-px-screen placeholder:text-px-muted focus:border-px-xp focus:outline-none disabled:opacity-50"
          />
          <PixelButton type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'SENDING…' : 'NOTIFY ME ▶'}</PixelButton>
        </form>
      )}
      {error && <p role="alert" className="text-px-glitch-text">{error}</p>}
      <p className="text-[20px] text-px-muted">No spam: only new-feature news.</p>
    </section>
  )
}
