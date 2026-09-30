/**
 * Dev-only: the Interrogation screen on a real recorded session, without the backend.
 * Served at /__chat when running `npm run dev` (routed in App.tsx behind import.meta.env.DEV).
 */
import { useEffect, useRef, useState } from 'react'
import fixture from '../../chat/__fixtures__/chatSession.json'
import { STAGES } from '../../pixel/cast'
import { PixelButton } from '../../pixel/ui/PixelButton'
import type { Evolution } from '../../chat/turns'
import { BattleScreen, type BattleSession } from './BattleScreen'
import { EvolutionScene } from './EvolutionScene'
import type { AssumptionStatus } from './FieldNotes'

const SNAPSHOTS = { intake: fixture.intake, debate: fixture.debate } as unknown as Record<
  'intake' | 'debate',
  BattleSession & { choices: string[] }
>

export function ChatDemo() {
  const [which, setWhich] = useState<'intake' | 'debate'>('intake')
  const [session, setSession] = useState<BattleSession & { choices: string[] }>(SNAPSHOTS.intake)
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [pending, setPending] = useState('')
  const [error, setError] = useState<'timeout' | 'network' | null>(null)
  const [evolution, setEvolution] = useState<Evolution | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()
  useEffect(() => () => clearInterval(timer.current), [])

  const load = (key: 'intake' | 'debate') => {
    clearInterval(timer.current)
    setWhich(key)
    setSession(SNAPSHOTS[key])
    setSending(false)
    setStreaming('')
    setError(null)
  }

  // Fake a turn: stream the debate snapshot's last question, then land on that snapshot
  const fakeTurn = (text: string) => {
    const history = SNAPSHOTS.debate.conversation_history
    const reply = history[history.length - 1].content
    setPending(text)
    setSending(true)
    setStreaming('')
    let i = 0
    clearInterval(timer.current)
    setTimeout(() => {
      timer.current = setInterval(() => {
        i += 12
        setStreaming(reply.slice(0, i))
        if (i >= reply.length) {
          clearInterval(timer.current)
          setSending(false)
          setStreaming('')
          setWhich('debate')
          setSession(SNAPSHOTS.debate)
          setEvolution({ from: STAGES[0], to: STAGES[1] })
        }
      }, 30)
    }, 900)
  }

  const cycle = (index: number, next: AssumptionStatus) =>
    setSession((s) => ({ ...s, assumptions: s.assumptions.map((a, i) => (i === index ? { ...a, status: next } : a)) }))

  return (
    <div className="min-h-screen bg-px-night font-term text-[22px] text-px-screen">
      {evolution && <EvolutionScene evolution={evolution} onClose={() => setEvolution(null)} />}
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3">
          <p className="text-[20px] text-px-muted">DEV · /__chat · snapshot: {which}</p>
          <div className="flex flex-wrap gap-2">
            <PixelButton variant="secondary" onClick={() => load('intake')}>EGG (TURN 1)</PixelButton>
            <PixelButton variant="secondary" onClick={() => load('debate')}>HATCHLING (TURN 3)</PixelButton>
            <PixelButton variant="secondary" onClick={() => setError(error ? null : 'network')}>TOGGLE ERROR</PixelButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGES.slice(1).map((to, i) => (
              <PixelButton key={to.phase} variant="secondary" onClick={() => setEvolution({ from: STAGES[i], to })}>
                EVOLVE → {to.name.toUpperCase()}
              </PixelButton>
            ))}
          </div>
        </div>
        <BattleScreen
          session={session}
          isSending={sending}
          streaming={streaming}
          choices={session.choices}
          pendingAnswer={pending}
          streamError={error}
          savedFlash={false}
          onSend={fakeTurn}
          onRetry={() => setError(null)}
          onCycleAssumption={cycle}
        />
      </div>
    </div>
  )
}
