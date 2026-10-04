import type { ButtonHTMLAttributes } from 'react'

// Literal class names: Tailwind drops component classes it can't see spelled out
const VARIANTS = {
  primary: 'pixel-btn-primary',
  secondary: 'pixel-btn-secondary',
} as const

const SIZES = {
  md: '',
  sm: 'pixel-btn-sm',
  lg: 'pixel-btn-lg',
} as const

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  /** `sm` for toolbars and headers (36px tall, 10px text); `lg` for a page's one main action (60px, 14px). */
  size?: keyof typeof SIZES
  /** Opt-in hover lift and a 3px press (the landing page). Off under prefers-reduced-motion. */
  lift?: boolean
}

/** A → for button labels. The pixel face has no arrow, so it is set in the text face at a matching size. */
export function Arrow() {
  return <span aria-hidden="true" className="ml-2 inline-block font-term text-[max(20px,1.7em)] leading-[0]">→</span>
}

export function PixelButton({ variant = 'primary', size = 'md', lift = false, type = 'button', className = '', ...rest }: PixelButtonProps) {
  return <button type={type} className={`pixel-btn ${VARIANTS[variant]} ${SIZES[size]} ${lift ? 'pixel-btn-lift' : ''} ${className}`} {...rest} />
}
