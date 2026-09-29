import type { CreatureType } from '../cast'

// Full class strings so Tailwind's scanner sees them. Ghost uses cream text: ink on
// the ghost violet fails AA.
const STYLES: Record<CreatureType, string> = {
  steel: 'bg-px-steel text-px-ink',
  psychic: 'bg-px-psychic text-px-ink',
  fighting: 'bg-px-fighting text-px-ink',
  electric: 'bg-px-electric text-px-ink',
  ghost: 'bg-px-ghost text-px-screen',
}

export function TypeBadge({ type }: { type: CreatureType }) {
  return (
    <span className={`font-term text-[20px] leading-none uppercase px-2 py-[3px] border-2 border-px-ink ${STYLES[type]}`}>
      {type}
    </span>
  )
}
