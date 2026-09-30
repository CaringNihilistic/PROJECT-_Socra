import { useEffect, useRef, useState } from 'react'

export type AssumptionStatus = 'unknown' | 'validated' | 'disproved'

const NEXT: Record<AssumptionStatus, AssumptionStatus> = { unknown: 'validated', validated: 'disproved', disproved: 'unknown' }

// Literal class names so Tailwind keeps them
const CHIP: Record<AssumptionStatus, { className: string; mark: string; label: string }> = {
  unknown: { className: 'border-px-edge text-px-soft', mark: '?', label: 'unchecked' },
  validated: { className: 'border-px-plan text-px-plan', mark: '✓', label: 'validated' },
  disproved: { className: 'border-px-glitch text-px-glitch-text', mark: '✗', label: 'disproved' },
}

interface FieldNotesProps {
  assumptions: { text: string; status: AssumptionStatus }[]
  onCycle: (index: number, next: AssumptionStatus) => void
}

/** The assumptions Socra has noted; clicking one cycles unchecked → ✓ → ✗. */
export function FieldNotes({ assumptions, onCycle }: FieldNotesProps) {
  const [open, setOpen] = useState(true)
  const seen = useRef(assumptions.length)

  // A new assumption re-opens the notes
  useEffect(() => {
    if (assumptions.length > seen.current) setOpen(true)
    seen.current = assumptions.length
  }, [assumptions.length])

  const validated = assumptions.filter((a) => a.status === 'validated').length
  const disproved = assumptions.filter((a) => a.status === 'disproved').length

  return (
    <section className="pixel-panel p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="field-notes"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan"
      >
        <h2 className="font-pixel text-[11px] leading-relaxed text-px-xp">FIELD NOTES</h2>
        <span className="text-px-soft">{assumptions.length} assumptions</span>
        {validated > 0 && <span className="text-px-plan">✓ {validated}</span>}
        {disproved > 0 && <span className="text-px-glitch-text">✗ {disproved}</span>}
        <span aria-hidden="true" className="ml-auto text-px-xp">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div id="field-notes" className="mt-4 flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2">
            {assumptions.map((a, i) => {
              const chip = CHIP[a.status]
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onCycle(i, NEXT[a.status])}
                    aria-label={`${a.text} (${chip.label}). Change status`}
                    className={`flex items-start gap-2 border-[3px] bg-px-night px-3 py-1 text-left text-[20px] leading-tight hover:border-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-px-plan ${chip.className}`}
                  >
                    <span aria-hidden="true">{chip.mark}</span>
                    {a.text}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-[20px] text-px-muted">Click a note to mark it validated ✓ or disproved ✗.</p>
        </div>
      )}
    </section>
  )
}
