import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PROFESSOR } from '../../pixel/cast'
import { DialogBox } from '../../pixel/ui/DialogBox'
import type { DialogLine } from '../../chat/turns'

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-dialog max-w-none text-[22px] leading-snug sm:text-[26px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

const plain = (text: string) => text.replace(/[*_#>`]/g, '')

/** Prof. Socra's dialog box: the current question, or his reply as it streams in. */
export function SocraDialog({ line }: { line: DialogLine }) {
  return (
    <div>
      <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
        {line.kind === 'waiting' && (
          <span>
            <span className="sr-only">Prof. Socra is thinking</span>
            <span aria-hidden="true" className="pixel-blink">…</span>
          </span>
        )}
        {line.kind === 'streaming' && (
          <>
            <Markdown>{line.text}</Markdown>
            <span aria-hidden="true" className="pixel-blink">▌</span>
          </>
        )}
        {(line.kind === 'question' || line.kind === 'fallback') && <Markdown>{line.text}</Markdown>}
        {line.kind === 'intro' && <p>{PROFESSOR.line}</p>}
      </DialogBox>
      {/* Announce finished questions only: streamed tokens would flood a screen reader */}
      <p aria-live="polite" className="sr-only">
        {line.kind === 'question' || line.kind === 'fallback' ? `Prof. Socra: ${plain(line.text)}` : ''}
      </p>
    </div>
  )
}
