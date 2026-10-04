import type { ReactNode } from 'react'

// A stepped pixel tail, 4px per step: ink edges, cream fill. The first row is all cream so it
// covers the bubble's border where the tail joins.
const STEPS = [0, 1, 2, 3, 4]
const INK = '#1b1a2e'
const CREAM = '#f4ecd8'

function Tail({ side }: { side: 'bottom' | 'left' }) {
  const rects = STEPS.flatMap((i) => {
    const span = 10 - 2 * i
    // `bottom`: rows narrowing downward. `left`: the same shape turned to point left.
    const at = (offset: number, length: number, fill: string) =>
      side === 'bottom'
        ? <rect key={`${i}-${offset}-${fill}`} x={offset} y={i} width={length} height={1} fill={fill} />
        : <rect key={`${i}-${offset}-${fill}`} x={4 - i} y={offset} width={1} height={length} fill={fill} />
    return i === 0 ? [at(0, 10, INK), at(1, 8, CREAM)] : [at(i, span, INK), ...(span > 2 ? [at(i + 1, span - 2, CREAM)] : [])]
  })
  return side === 'bottom' ? (
    <svg aria-hidden="true" viewBox="0 0 10 5" width={40} height={20} shapeRendering="crispEdges" className="absolute left-16 top-full -mt-1">
      {rects}
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 5 10" width={20} height={40} shapeRendering="crispEdges" className="absolute right-full top-4 -mr-1">
      {rects}
    </svg>
  )
}

interface SpeechBubbleProps {
  /** Where the tail points: down to a character standing below, or left to one standing beside. */
  tail?: 'bottom' | 'left'
  className?: string
  children: ReactNode
}

/** A speech bubble for a character who stands outside it (DialogBox puts the speaker inside). */
export function SpeechBubble({ tail = 'bottom', className = '', children }: SpeechBubbleProps) {
  return (
    <div className={`relative border-4 border-px-ink bg-px-screen px-5 py-4 font-term text-px-ink ${className}`}>
      {children}
      <Tail side={tail} />
    </div>
  )
}
