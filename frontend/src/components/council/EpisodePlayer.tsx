import { useEffect } from 'react'
import { PROFESSOR, TEAM_GLITCH } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { DialogBox } from '../../pixel/ui/DialogBox'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { PixelPanel } from '../../pixel/ui/PixelPanel'
import type { Beat, EpisodeState } from '../../episode/reducer'
import { CouncilArena } from './CouncilArena'
import { PlanRelay } from './PlanRelay'

const BEAT_TITLE: Record<Beat, string> = {
  scouting: 'THE COUNCIL CONVENES',
  council: 'THE COUNCIL DELIBERATES',
  plan: 'THE TRAINERS PRESENT',
  ambush: 'AMBUSH!',
  done: 'EPISODE COMPLETE',
  failed: 'THE EPISODE WAS CUT SHORT',
}

interface EpisodePlayerProps {
  episode: EpisodeState
  onSkip: () => void
  onClose: () => void
  onRetry?: () => void
}

export function EpisodePlayer({ episode, onSkip, onClose, onRetry }: EpisodePlayerProps) {
  const { beat, queries, seats, extras, plan, glitch } = episode
  const finished = beat === 'done' || beat === 'failed'
  const showPlan = beat === 'plan' || beat === 'ambush' || (finished && plan.status !== 'waiting')
  const showGlitch = glitch.status === 'done' || glitch.status === 'fainted'

  // Esc skips while playing and closes once finished
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (finished ? onClose : onSkip)()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, onClose, onSkip])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="episode-title" className="fixed inset-0 z-50 overflow-y-auto bg-px-night font-term text-[22px] text-px-screen">
      {beat === 'ambush' && <div className="pixel-flash pointer-events-none fixed inset-0" aria-hidden="true" />}
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[20px] text-px-muted">EPISODE</p>
            <h2 id="episode-title" className="font-pixel text-sm leading-relaxed text-px-xp">
              {BEAT_TITLE[beat]}
            </h2>
          </div>
          {finished ? (
            <PixelButton autoFocus onClick={onClose}>SEE RESULTS ▶</PixelButton>
          ) : (
            <PixelButton autoFocus variant="secondary" onClick={onSkip}>SKIP ▶▶</PixelButton>
          )}
        </header>
        <p aria-live="polite" className="sr-only">{BEAT_TITLE[beat]}</p>

        {beat === 'scouting' ? (
          <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite} more={false}>
            {queries.length ? 'Scouting the market…' : 'The council is gathering…'}
            {queries.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-[22px]">
                {queries.map((q) => (
                  <li key={q}>▶ {q}</li>
                ))}
              </ul>
            )}
          </DialogBox>
        ) : (
          <CouncilArena seats={seats} extras={extras} />
        )}

        {showPlan && <PlanRelay plan={plan} />}

        {showGlitch && (
          <PixelPanel title="AMBUSH! TEAM GLITCH" accent="glitch">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              {TEAM_GLITCH.members.map((m) => (
                <Sprite key={m.name} name={m.sprite} size={64} />
              ))}
              <p className="text-[24px]">“{TEAM_GLITCH.motto}”</p>
            </div>
            {glitch.status === 'done' && glitch.signature ? (
              <DialogBox speaker="HEX" sprite="hex">{glitch.signature}</DialogBox>
            ) : (
              <p className="text-px-glitch-text">Team Glitch blasted off before finishing their critique!</p>
            )}
          </PixelPanel>
        )}

        {beat === 'failed' && (
          <PixelPanel title="CONNECTION LOST" accent="glitch">
            <p className="mb-4 text-px-soft">The episode was cut off before the council finished.</p>
            {onRetry && <PixelButton onClick={onRetry}>TRY AGAIN</PixelButton>}
          </PixelPanel>
        )}
        {beat === 'done' && plan.status === 'failed' && onRetry && (
          <PixelButton className="self-start" onClick={onRetry}>TRY AGAIN</PixelButton>
        )}
      </div>
    </div>
  )
}
