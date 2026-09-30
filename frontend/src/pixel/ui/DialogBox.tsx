import type { ReactNode } from 'react'
import { Sprite } from '../Sprite'
import type { SpriteName } from '../sprites'

interface DialogBoxProps {
  speaker: string
  sprite: SpriteName
  /** Show the blinking "more" arrow, as when a character has more to say. */
  more?: boolean
  children: ReactNode
}

export function DialogBox({ speaker, sprite, more = false, children }: DialogBoxProps) {
  return (
    <div className="pixel-dialog flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:py-5">
      {/* Two sizes rather than CSS scaling: sprites only render at whole-number scales.
          On phones the sprite sits beside the name so the text gets the full width. */}
      <div className="flex items-center gap-3 sm:hidden">
        <Sprite name={sprite} size={64} />
        <p className="font-pixel text-[11px] text-px-ghost">{speaker}</p>
      </div>
      <Sprite name={sprite} size={96} className="hidden sm:block" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="hidden font-pixel text-[11px] text-px-ghost sm:block">{speaker}</p>
        <div className="font-term text-[22px] leading-snug text-px-ink sm:text-[26px]">
          {children}
          {more && <span aria-hidden="true" className="pixel-blink font-pixel text-[11px] ml-2">▼</span>}
        </div>
      </div>
    </div>
  )
}
