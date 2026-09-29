import type { ButtonHTMLAttributes } from 'react'

// Literal class names: Tailwind drops component classes it can't see spelled out
const VARIANTS = {
  primary: 'pixel-btn-primary',
  secondary: 'pixel-btn-secondary',
} as const

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
}

export function PixelButton({ variant = 'primary', type = 'button', className = '', ...rest }: PixelButtonProps) {
  return <button type={type} className={`pixel-btn ${VARIANTS[variant]} ${className}`} {...rest} />
}
