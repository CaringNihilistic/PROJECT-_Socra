import { forwardRef } from 'react'
import { PixelButton } from '../../pixel/ui/PixelButton'

interface AnswerBoxProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
  followUp: boolean
}

/** The answer textarea. Enter sends, Shift+Enter adds a line. */
export const AnswerBox = forwardRef<HTMLTextAreaElement, AnswerBoxProps>(function AnswerBox(
  { value, onChange, onSend, disabled, followUp },
  ref,
) {
  return (
    <div className="pixel-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:p-4">
      <label htmlFor="answer-box" className="sr-only">
        {followUp ? 'Ask a follow-up' : 'Your answer to Prof. Socra'}
      </label>
      <textarea
        id="answer-box"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder={followUp ? 'Ask a follow-up…' : 'Answer Prof. Socra…'}
        rows={3}
        disabled={disabled}
        className="min-h-[96px] w-full flex-1 resize-none border-[3px] border-px-edge bg-px-night px-3 py-2 font-term text-[22px] leading-snug text-px-screen placeholder:text-px-muted focus:border-px-xp focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <span className="text-[20px] text-px-muted">⇧↵ new line</span>
        <PixelButton disabled={disabled || !value.trim()} onClick={onSend}>SEND ▶</PixelButton>
      </div>
    </div>
  )
})
