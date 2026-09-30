import type { ButtonHTMLAttributes } from 'react'

// Literal class names: Tailwind drops component classes it can't see spelled out
const VARIANTS = {
  primary: 'pixel-btn-primary',
  secondary: 'pixel-btn-secondary',
} as const

const SIZES = {
  md: '',
  sm: 'pixel-btn-sm',
} as const

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  /** `sm` for toolbars and headers (36px tall, 10px text). */
  size?: keyof typeof SIZES
}

export function PixelButton({ variant = 'primary', size = 'md', type = 'button', className = '', ...rest }: PixelButtonProps) {
  return <button type={type} className={`pixel-btn ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest} />
}
