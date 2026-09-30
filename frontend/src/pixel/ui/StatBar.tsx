// Literal class names: Tailwind drops arbitrary classes it can't see spelled out
const GRIDS = {
  wide: 'grid-cols-[150px_minmax(0,1fr)_40px]',
  compact: 'grid-cols-[104px_minmax(0,1fr)_36px]',
} as const

interface StatBarProps {
  label: string
  /** 0–1 */
  value: number
  /** `compact` fits five short labels (CLARITY, SCALE…) beside a sprite. */
  width?: keyof typeof GRIDS
  /** Decorative marker after the label, e.g. ▸ on a row that opens a note. */
  hint?: string
}

export function StatBar({ label, value, width = 'wide', hint }: StatBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={`grid ${GRIDS[width]} items-center gap-3`}>
      <span className="font-term text-[22px] text-px-soft">
        {label}
        {hint && <span aria-hidden="true" className="ml-1 text-px-xp">{hint}</span>}
      </span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-3 border-2 border-px-ink bg-px-night"
      >
        <div className="h-full bg-px-plan" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-term text-[22px] text-right text-px-screen">{pct}</span>
    </div>
  )
}
