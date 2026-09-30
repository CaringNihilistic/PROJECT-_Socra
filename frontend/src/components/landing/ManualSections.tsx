import { useState } from 'react'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { PixelPanel } from '../../pixel/ui/PixelPanel'

const OTHERS = [
  'ChatGPT celebrates your idea. It’s designed to be agreeable.',
  'Lean Canvas is a template, not a challenge. No pushback, no score.',
  '“Validate your idea” tools return generic output founders immediately discount.',
  'Accelerator feedback is one-way, with no real-time interrogation.',
  'Nobody names the assumption that kills this in year 1.',
]
const SOCRA = [
  'Five advisors with distinct voices, each looking for a different reason this fails.',
  'Specific objections: named competitors, real regulations, actual cost estimates.',
  'Every assumption surfaced and tracked, so you know exactly what you’re betting on.',
  'A verdict you can trust precisely because Socra has a reputation for saying no.',
  'The one conversation worth having before you quit your job for this.',
]

export function SaysNo() {
  return (
    <section aria-labelledby="says-no-title" className="flex flex-col gap-6">
      <h2 id="says-no-title" className="max-w-3xl text-[36px] leading-[1.05] text-px-screen sm:text-[44px]">
        Every AI tool is built to say yes. <span className="text-px-xp">Socra says no.</span>
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <PixelPanel title="✗ EVERY OTHER TOOL" accent="glitch">
          <ul className="flex flex-col gap-3">
            {OTHERS.map((t) => <li key={t} className="text-px-soft">▶ {t}</li>)}
          </ul>
        </PixelPanel>
        <PixelPanel title="✓ SOCRA" accent="plan">
          <ul className="flex flex-col gap-3">
            {SOCRA.map((t) => <li key={t} className="text-px-soft">▶ {t}</li>)}
          </ul>
        </PixelPanel>
      </div>
    </section>
  )
}

export function FreeToPlay({ onStart }: { onStart: () => void }) {
  return (
    <section id="free" aria-labelledby="free-title" className="scroll-mt-24">
      <PixelPanel accent="plan">
        <div className="flex flex-col gap-4">
          <h2 id="free-title" className="font-pixel text-sm leading-relaxed text-px-plan">FREE TO PLAY</h2>
          <p className="text-[28px] leading-tight text-px-screen">Everything is free. No paywall, no account needed to start.</p>
          <ul className="flex flex-col gap-2 text-px-soft">
            <li>✓ The full interrogation: stats, evolution, field notes</li>
            <li>✓ The council, Team Glitch and the Chairman’s masterplan, once your score is ready</li>
            <li>✓ Export, share links, score cards and comparisons</li>
          </ul>
          <p className="text-px-muted">
            If it helped you think clearly, an optional ₹499 donation (via Razorpay: UPI, cards, net banking) keeps the LLM costs covered.
          </p>
          <PixelButton className="self-start" onClick={onStart}>PRESS START ▶</PixelButton>
        </div>
      </PixelPanel>
    </section>
  )
}

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
