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
    <div className="pixel-dialog flex items-end gap-5 px-6 py-5">
      <Sprite name={sprite} size={96} />
      <div className="flex flex-col gap-2 min-w-0">
        <p className="font-pixel text-[11px] text-px-ghost">{speaker}</p>
        <div className="font-term text-[26px] leading-snug text-px-ink">
          {children}
          {more && <span aria-hidden="true" className="pixel-blink font-pixel text-[11px] ml-2">▼</span>}
        </div>
      </div>
    </div>
  )
}
