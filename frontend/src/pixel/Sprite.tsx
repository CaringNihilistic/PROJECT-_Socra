import { buildSprite, type SpriteName } from './sprites'

/** Whole-number scales of the 32px sprite only: a fractional scale smears pixel art. */
export type SpriteSize = 32 | 64 | 96 | 128

interface SpriteProps {
  name: SpriteName
  size: SpriteSize
  /** Accessible name. Omit for decorative sprites next to a visible name. */
  label?: string
  /** Opt-in 2-frame idle bob (disabled under prefers-reduced-motion). */
  bob?: boolean
  className?: string
}

export function Sprite({ name, size, label, bob = false, className = '' }: SpriteProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`shrink-0 ${bob ? 'pixel-bob' : ''} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {buildSprite(name).map((layer) => (
        <path key={layer.fill} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  )
}
