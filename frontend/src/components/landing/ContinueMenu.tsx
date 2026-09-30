import type { ReactNode } from 'react'
import { STAGES, stageForPhase } from '../../pixel/cast'
import type { SessionSummary } from '../../store/sessionStore'

const FINAL = STAGES[STAGES.length - 1]

interface ContinueMenuProps {
  sessions: SessionSummary[]
  compareId: string | null
  loading: boolean
  onResume: (id: string) => void
  /** Select, deselect, or (with one selected) open /compare. */
  onCompare: (id: string) => void
  /** The "sign in to sync" nudge, when relevant. */
  nudge?: ReactNode
}

/** Recent sessions as save files. Sessions with a plan can be compared. */
export function ContinueMenu({ sessions, compareId, loading, onResume, onCompare, nudge }: ContinueMenuProps) {
  if (!sessions.length) return null
  return (
    <section aria-labelledby="continue-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="continue-title" className="font-pixel text-[10px] leading-relaxed text-px-muted">CONTINUE</h2>
        {nudge}
      </div>
      {compareId && (
        <p role="status" className="border-2 border-dashed border-px-xp px-3 py-1 text-[20px] text-px-xp">
          ↔ PICK ANOTHER PLAN TO COMPARE (or click ↔ again to cancel)
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {sessions.slice(0, 6).map((s) => {
          const stage = s.has_masterplan ? FINAL : stageForPhase(s.phase)
          const selected = s.id === compareId
          return (
            <li key={s.id} className={`flex items-stretch border-[3px] bg-px-night ${selected ? 'border-px-xp' : 'border-px-edge'}`}>
              <button
                type="button"
                disabled={loading}
                onClick={() => onResume(s.id)}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-px-panel focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-px-plan disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 basis-48 truncate text-px-screen">{s.initial_idea}</span>
                <span className="text-[20px] text-px-xp">{stage.name.toUpperCase()}</span>
                <span className="text-[20px] text-px-soft">{Math.round(s.total_score * 100)}%</span>
                {s.has_masterplan && <span className="text-[20px] text-px-plan">✓ PLAN</span>}
              </button>
              {s.has_masterplan && (
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={selected ? 'Cancel compare' : compareId ? 'Compare with the selected plan' : 'Select to compare'}
                  onClick={() => onCompare(s.id)}
                  className={`border-l-[3px] border-px-edge px-4 text-[22px] hover:text-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-px-plan ${selected ? 'text-px-xp' : 'text-px-muted'}`}
                >
                  ↔
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
