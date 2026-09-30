import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import type { SessionData } from '../store/sessionStore'
import { PixelButton } from '../pixel/ui/PixelButton'
import { TradingCard, type CardSession } from './share/TradingCard'
import { Loading, NotFound, PublicShell, RunYourIdea } from './share/ShareChrome'
import { downloadPng } from './share/pngExport'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const slug = (idea: string) =>
  idea.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+$/, '') || 'idea'

/** The card with its actions; separate from the fetch so it renders in tests. */
export function CardView({ session }: { session: CardSession }) {
  const card = useRef<HTMLElement>(null)
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [copied, setCopied] = useState(false)

  const download = async () => {
    if (!card.current) return
    setStatus('busy')
    try {
      await downloadPng(card.current, `socra-card-${slug(session.initial_idea)}.png`)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  const copy = () =>
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Below 368px the card scrolls sideways rather than scaling (scaling blurs sprites) */}
      <div className="max-w-full overflow-x-auto">
        <TradingCard ref={card} session={session} />
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <PixelButton disabled={status === 'busy'} onClick={download}>
          {status === 'busy' ? 'DRAWING…' : 'DOWNLOAD PNG'}
        </PixelButton>
        <PixelButton variant="secondary" onClick={copy}>COPY LINK</PixelButton>
        <RunYourIdea />
      </div>
      <p aria-live="polite" className="min-h-[1.5em] text-center text-[20px]">
        {status === 'failed' ? (
          <span className="text-px-glitch-text">Couldn’t create the image. Try again, or take a screenshot.</span>
        ) : copied ? (
          <span className="text-px-plan">Link copied</span>
        ) : (
          <span className="text-px-muted">Post it with #SocraScore</span>
        )}
      </p>
    </div>
  )
}

export function CardPage({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    axios
      .get<SessionData>(`${API_URL}/sessions/${sessionId}`)
      .then(({ data }) => {
        setSession(data)
        setState('ready')
      })
      .catch(() => setState('missing'))
  }, [sessionId])

  return (
    <PublicShell section="SCORE CARD">
      {state === 'loading' && <Loading what="CARD" />}
      {state === 'missing' && <NotFound message="This card doesn’t exist. Maybe yours should?" />}
      {state === 'ready' && session && <CardView session={session} />}
    </PublicShell>
  )
}
