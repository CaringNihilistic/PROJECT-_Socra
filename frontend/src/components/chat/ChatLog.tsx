import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Turn } from '../../chat/turns'

/** Earlier turns, collapsed by default so the current question stays on screen. */
export function ChatLog({ turns }: { turns: readonly Turn[] }) {
  const [open, setOpen] = useState(false)
  if (!turns.length) return null

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="chat-log"
        onClick={() => setOpen(!open)}
        className="self-start font-pixel text-[11px] leading-relaxed text-px-xp hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-px-plan"
      >
        {open ? '▾' : '▸'} LOG ({turns.length})
      </button>
      {open && (
        <ol id="chat-log" className="flex flex-col gap-4">
          {turns.map((t, i) =>
            t.role === 'assistant' ? (
              <li key={i} className="pixel-dialog px-4 py-3">
                <p className="font-pixel text-[10px] text-px-ghost">PROF. SOCRA</p>
                <div className="prose prose-dialog max-w-none text-[22px] leading-snug [overflow-wrap:break-word]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
                </div>
              </li>
            ) : (
              <li key={i} className="pixel-panel ml-auto max-w-[85%] px-4 py-3">
                <p className="font-pixel text-[10px] text-px-plan">YOU</p>
                <p className="whitespace-pre-wrap text-[22px] text-px-soft">{t.content}</p>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  )
}
