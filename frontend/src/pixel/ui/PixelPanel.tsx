import type { ReactNode } from 'react'

type Accent = 'edge' | 'glitch' | 'plan'

// Outer-ring colour (via --pixel-edge) and title colour per accent. Title colours are
// the text-safe tokens: px-glitch itself fails AA as text on a panel.
const ACCENTS: Record<Accent, { ring: string; title: string }> = {
  edge: { ring: '', title: 'text-px-xp' },
  glitch: { ring: 'pixel-edge-glitch', title: 'text-px-glitch-text' },
  plan: { ring: 'pixel-edge-plan', title: 'text-px-plan' },
}

interface PixelPanelProps {
  title?: string
  accent?: Accent
  className?: string
  children: ReactNode
}

export function PixelPanel({ title, accent = 'edge', className = '', children }: PixelPanelProps) {
  const { ring, title: titleColour } = ACCENTS[accent]
  return (
    <section className={`pixel-panel ${ring} p-6 ${className}`}>
      {title && <h2 className={`font-pixel text-xs leading-relaxed mb-4 ${titleColour}`}>{title}</h2>}
      {children}
    </section>
  )
}
