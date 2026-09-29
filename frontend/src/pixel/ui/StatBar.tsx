interface StatBarProps {
  label: string
  /** 0–1 */
  value: number
}

export function StatBar({ label, value }: StatBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)_40px] items-center gap-3">
      <span className="font-term text-[22px] text-px-soft">{label}</span>
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
