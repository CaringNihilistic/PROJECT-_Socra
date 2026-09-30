import { forwardRef } from 'react'
import { Sprite } from '../../pixel/Sprite'
import { StatBar } from '../../pixel/ui/StatBar'
import { STAT_ROWS, stageForSession, type StatKey } from '../../chat/turns'
import { cardNumber, flavorText, gradeFor } from '../../share/card'
import { truncate } from '../../episode/signature'

export interface CardSession {
  id: string
  initial_idea: string
  phase: string
  total_score: number
  masterplan: string | null
  scores: Partial<Record<StatKey, number>>
}

/** Your idea as a collector card. Fixed 336px wide so the PNG is identical everywhere. */
export const TradingCard = forwardRef<HTMLElement, { session: CardSession }>(function TradingCard({ session }, ref) {
  const score = Math.round(session.total_score * 100)
  const stage = stageForSession(session)
  const grade = gradeFor(score)
  const flavor = flavorText(session.masterplan)

  return (
    <article
      ref={ref}
      aria-label={`Score card: ${session.initial_idea}. ${score} out of 100, ${grade.label}.`}
      className={`relative flex w-[336px] shrink-0 flex-col gap-3 border-[6px] bg-px-panel p-3 font-term text-px-screen ${grade.frame}`}
    >
      {grade.holo && <div aria-hidden="true" className="pixel-holo pointer-events-none absolute inset-0" />}

      <header className="flex items-baseline justify-between gap-2">
        <span className="font-pixel text-[10px] leading-relaxed text-px-soft">IDEA · {stage.name.toUpperCase()}</span>
        <span className="font-pixel text-xs text-px-xp">HP {score}</span>
      </header>

      <div className="flex h-[152px] items-center justify-center border-4 border-px-ink bg-px-screen">
        <Sprite name={stage.sprite} size={128} label={stage.name} />
      </div>

      {/* Truncated in code, not just line-clamp: the PNG renderer drops the clamp's ellipsis */}
      <p className="line-clamp-3 text-[22px] leading-tight">{truncate(session.initial_idea, 84)}</p>

      <p className={`font-pixel text-[10px] leading-relaxed ${grade.text}`}>
        {stage.name.toUpperCase()} · {grade.label}
      </p>

      <div className="flex flex-col gap-1">
        {STAT_ROWS.map(({ key, label }) => (
          <StatBar key={key} label={label} value={session.scores[key] ?? 0} width="compact" />
        ))}
      </div>

      <p className="border-y-2 border-px-edge py-2 text-[20px] leading-tight text-px-soft">
        {flavor ? `“${flavor}”` : '“Still under interrogation.”'}
      </p>

      <footer className="flex items-center justify-between">
        <span className="font-pixel text-[10px] text-px-xp">SOCRA</span>
        <span className="text-[20px] text-px-muted">{cardNumber(session.id)}</span>
      </footer>
    </article>
  )
})
