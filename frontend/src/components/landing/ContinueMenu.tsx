import type { ReactNode } from 'react'
import { STAGES, stageForPhase } from '../../pixel/cast'
import type { SessionSummary } from '../../store/sessionStore'

const FINAL = STAGES[STAGES.length - 1]
const ring = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-px-plan'

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

/**
 * "Your runs": recent sessions as a compact strip under the hero. Renders nothing for a
 * first-time visitor. Sessions with a plan can be compared.
 */
export function ContinueMenu({ sessions, compareId, loading, onResume, onCompare, nudge }: ContinueMenuProps) {
  if (!sessions.length) return null
  return (
    <section aria-labelledby="continue-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h2 id="continue-title" className="font-pixel text-[13px] leading-relaxed text-px-screen">
          YOUR RUNS <span className="sr-only">(CONTINUE)</span>
        </h2>
        <p className="text-[20px] text-px-muted">Pick one to continue. ↔ compares two finished plans.</p>
        {nudge && <span className="ml-auto">{nudge}</span>}
      </div>
      {compareId && (
        <p role="status" className="border-2 border-dashed border-px-xp px-3 py-1 text-[20px] text-px-xp sm:self-start">
          ↔ PICK ANOTHER PLAN TO COMPARE (or click ↔ again to cancel)
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sessions.slice(0, 6).map((s) => {
          const stage = s.has_masterplan ? FINAL : stageForPhase(s.phase)
          const selected = s.id === compareId
          return (
            <li key={s.id} className={`flex min-w-0 items-stretch border-2 bg-px-panel ${selected ? 'border-px-xp' : 'border-px-edge'}`}>
              <button
                type="button"
                disabled={loading}
                onClick={() => onResume(s.id)}
                className={`flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-px-edge disabled:opacity-50 ${ring}`}
              >
                <span className="w-full truncate text-[22px] text-px-screen">{s.initial_idea}</span>
                <span className="flex flex-wrap gap-x-3 text-[20px]">
                  <span className="text-px-xp">{stage.name.toUpperCase()}</span>
                  <span className="text-px-soft">{Math.round(s.total_score * 100)}%</span>
                  {s.has_masterplan && <span className="text-px-plan">✓ PLAN</span>}
                </span>
              </button>
              {s.has_masterplan && (
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={selected ? 'Cancel compare' : compareId ? 'Compare with the selected plan' : 'Select to compare'}
                  onClick={() => onCompare(s.id)}
                  className={`min-w-[52px] border-l-2 border-px-edge px-4 text-[24px] transition-colors duration-150 hover:text-px-xp ${ring} ${selected ? 'bg-px-xp text-px-ink hover:text-px-ink' : 'text-px-muted'}`}
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
