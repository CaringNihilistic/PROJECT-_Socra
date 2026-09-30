import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { PixelPanel } from '../../pixel/ui/PixelPanel'
import { dialogLine, logTurns, stageForSession, type StatKey, type Turn } from '../../chat/turns'
import { AnswerBox } from './AnswerBox'
import { AnswerMenu } from './AnswerMenu'
import { ChatLog } from './ChatLog'
import { FieldNotes, type AssumptionStatus } from './FieldNotes'
import { IdeaCard } from './IdeaCard'
import { SocraDialog } from './SocraDialog'

export interface BattleSession {
  phase: string
  masterplan: string | null
  total_score: number
  scores: Partial<Record<StatKey, number>>
  explanations: { dimension: string; status_text: string }[]
  conversation_history: Turn[]
  assumptions: { text: string; status: AssumptionStatus }[]
  refusal?: string | null
}

interface BattleScreenProps {
  session: BattleSession
  isSending: boolean
  streaming: string
  choices: readonly string[]
  /** The answer being sent, shown until the saved session includes it. */
  pendingAnswer: string
  streamError: 'timeout' | 'network' | null
  savedFlash: boolean
  onSend: (text: string) => void
  onRetry?: () => void
  onCycleAssumption: (index: number, next: AssumptionStatus) => void
  /** Rendered under the idea card: the save nudge and dev/admin shortcuts. */
  extras?: ReactNode
}

/** The Interrogation screen: your idea creature, Prof. Socra's question, and your answer. */
export function BattleScreen({
  session,
  isSending,
  streaming,
  choices,
  pendingAnswer,
  streamError,
  savedFlash,
  onSend,
  onRetry,
  onCycleAssumption,
  extras,
}: BattleScreenProps) {
  const [input, setInput] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { conversation_history: history, masterplan } = session

  const line = dialogLine({ history, isSending, streaming, choices })
  const log = logTurns(history, line)
  const showMenu = choices.length > 0 && !isSending && !masterplan

  // Bring each new question into view (the idea card can push it below the fold on phones),
  // but not on first load: the page should open at the top
  const turnCount = history.length
  const seen = useRef({ turnCount, isSending })
  useEffect(() => {
    const changed = seen.current.turnCount !== turnCount || seen.current.isSending !== isSending
    seen.current = { turnCount, isSending }
    if (changed) dialogRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [turnCount, isSending])

  const send = () => {
    const text = input.trim()
    if (!text || isSending) return
    setInput('')
    onSend(text)
  }

  const prefill = (text: string) => {
    setInput(text)
    // After React commits the value: focus the box with the caret at the end
    requestAnimationFrame(() => {
      const el = box.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  return (
    <div className="flex flex-col gap-6 font-term text-[22px] text-px-screen">
      <IdeaCard
        stage={stageForSession(session)}
        score={session.total_score}
        scores={session.scores}
        explanations={session.explanations}
      />
      {extras}
      {session.assumptions.length > 0 && <FieldNotes assumptions={session.assumptions} onCycle={onCycleAssumption} />}

      <div ref={dialogRef} className="flex scroll-mt-40 flex-col gap-4">
        {isSending && pendingAnswer && (
          <div className="pixel-panel ml-auto max-w-[85%] px-4 py-3">
            <p className="font-pixel text-[10px] text-px-plan">YOU</p>
            <p className="whitespace-pre-wrap text-px-soft">{pendingAnswer}</p>
          </div>
        )}
        <SocraDialog line={line} />
      </div>

      {showMenu && <AnswerMenu choices={choices} onPick={prefill} onWriteOwn={() => prefill(input)} />}

      <p aria-live="polite" className="min-h-[1.2em] text-[20px] text-px-plan">{savedFlash ? 'SAVED ✓' : ''}</p>

      {streamError && !isSending && (
        <PixelPanel title="CONNECTION LOST" accent="glitch">
          <p className="mb-4 text-px-soft">
            {streamError === 'timeout' ? 'Prof. Socra took too long to answer.' : 'Prof. Socra lost the connection.'}
          </p>
          {onRetry && <PixelButton onClick={onRetry}>RETRY ▶</PixelButton>}
        </PixelPanel>
      )}

      {session.refusal && (
        <PixelPanel title="NOT YET">
          <p className="text-px-soft">{session.refusal}</p>
        </PixelPanel>
      )}

      {/* Sticky from tablet up; on a phone it would cover a third of the screen */}
      <div className="z-10 sm:sticky sm:bottom-4">
        <AnswerBox ref={box} value={input} onChange={setInput} onSend={send} disabled={isSending} followUp={!!masterplan} />
      </div>

      <ChatLog turns={log} />
    </div>
  )
}
