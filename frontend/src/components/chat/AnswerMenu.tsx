import type { KeyboardEvent } from 'react'
import { MenuChoice } from '../../pixel/ui/MenuChoice'

export const WRITE_OWN = 'Write my own answer…'

interface AnswerMenuProps {
  choices: readonly string[]
  /** Pre-fills the answer box with the choice; nothing is sent yet. */
  onPick: (choice: string) => void
  onWriteOwn: () => void
}

/** Suggested answers as a battle menu. ↑/↓ move between options and wrap. */
export function AnswerMenu({ choices, onPick, onWriteOwn }: AnswerMenuProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const options = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    const at = options.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    options[(at + step + options.length) % options.length].focus()
  }

  return (
    <nav aria-label="Suggested answers" className="flex flex-col gap-2">
      <p className="text-[20px] text-px-muted">Pick an answer to edit it before sending.</p>
      <ul onKeyDown={onKeyDown} className="flex flex-col gap-2">
        {/* Index keys: the LLM can repeat a choice */}
        {choices.map((choice, i) => (
          <li key={i}>
            <MenuChoice className="w-full" onClick={() => onPick(choice)}>{choice}</MenuChoice>
          </li>
        ))}
        <li>
          <MenuChoice className="w-full text-px-muted" onClick={onWriteOwn}>{WRITE_OWN}</MenuChoice>
        </li>
      </ul>
    </nav>
  )
}
