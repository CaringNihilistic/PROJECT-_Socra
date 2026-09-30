import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { COUNCIL, TEAM_GLITCH } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { PixelPanel } from '../../pixel/ui/PixelPanel'
import { TypeBadge } from '../../pixel/ui/TypeBadge'
import { parseSections } from '../../episode/sections'
import type { ResultsData } from '../../episode/results'
import type { Seat } from '../../episode/reducer'

// The Tech Stack section is always a table: let it scroll inside its box on phones
const MARKDOWN_COMPONENTS = {
  table: ({ node: _node, ...props }: ComponentPropsWithoutRef<'table'> & { node?: unknown }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-pixel max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{children}</ReactMarkdown>
    </div>
  )
}

function CouncilCard({ seat }: { seat: Seat }) {
  const [open, setOpen] = useState(false)
  const creature = COUNCIL[seat.key]
  const fainted = seat.status === 'fainted'
  return (
    <article className="pixel-panel flex flex-col gap-3 p-5">
      <div className="flex items-center gap-4">
        <div className={`border-4 border-px-ink bg-px-screen p-1 ${fainted ? 'grayscale' : ''}`}>
          <Sprite name={creature.sprite} size={64} />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-pixel text-[11px] leading-relaxed">{creature.name.toUpperCase()}</h3>
          <span className="text-[20px] text-px-xp">{creature.advisor} · {creature.role}</span>
        </div>
        <div className="ml-auto">
          <TypeBadge type={creature.type} />
        </div>
      </div>
      {seat.status === 'done' && seat.signature && <p className="text-px-soft">“{seat.signature}”</p>}
      {seat.status === 'thinking' && <p className="text-px-muted">Still thinking…</p>}
      {fainted && <p className="text-px-glitch-text">{creature.name} fainted! This advisor’s analysis failed.</p>}
      {seat.report && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="self-start text-[20px] text-px-plan hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-px-plan"
          >
            {open ? '▼ HIDE REPORT' : '▶ READ FULL REPORT'}
          </button>
          {open && <Markdown>{seat.report.content}</Markdown>}
        </>
      )}
    </article>
  )
}

interface ResultsProps {
  sessionId: string
  idea: string
  data: ResultsData
  canReplay: boolean
  onReplay: () => void
  /** Admin/dev re-run control. */
  rerun?: { onClick: () => void; busy: boolean; label: string }
  pipeline?: 'legacy' | 'langgraph'
  /** Rendered below the plan (follow-up capture, donation). */
  footer?: ReactNode
}

export function Results({ sessionId, idea, data, canReplay, onReplay, rerun, pipeline, footer }: ResultsProps) {
  const [flash, setFlash] = useState<string | null>(null)
  const sections = parseSections(data.plan)

  const confirm = (label: string) => {
    setFlash(label)
    setTimeout(() => setFlash(null), 2000)
  }
  const copyText = (text: string, label: string) => navigator.clipboard.writeText(text).then(() => confirm(label))
  const download = () => {
    const slug = idea.slice(0, 40).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const url = URL.createObjectURL(new Blob([data.plan], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `socra-${slug}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-10 font-term text-[22px] text-px-screen">
      <header className="flex flex-col gap-4">
        <p className="text-[20px] text-px-muted">RESULTS</p>
        <h1 className="font-pixel text-base leading-relaxed text-px-xp">The Council has spoken.</h1>
        <p className="text-px-soft">{idea}</p>
        <div className="flex flex-wrap items-center gap-3">
          {canReplay && <PixelButton onClick={onReplay}>▶ WATCH EPISODE</PixelButton>}
          <PixelButton variant="secondary" disabled={!data.plan} onClick={() => copyText(data.plan, 'Plan copied')}>COPY PLAN</PixelButton>
          <PixelButton variant="secondary" disabled={!data.plan} onClick={download}>DOWNLOAD .MD</PixelButton>
          <PixelButton variant="secondary" onClick={() => copyText(`${window.location.origin}/share/${sessionId}`, 'Share link copied')}>SHARE LINK</PixelButton>
          <PixelButton variant="secondary" onClick={() => copyText(`${window.location.origin}/card/${sessionId}`, 'Score card link copied')}>SCORE CARD</PixelButton>
          {rerun && (
            <PixelButton variant="secondary" disabled={rerun.busy} onClick={rerun.onClick}>{rerun.busy ? '…' : rerun.label}</PixelButton>
          )}
          {pipeline === 'langgraph' && <span className="border-2 border-px-plan px-2 text-[20px] text-px-plan">LANGGRAPH</span>}
        </div>
        <p aria-live="polite" className="min-h-[1.5em] text-[20px] text-px-plan">{flash ?? ''}</p>
      </header>

      {data.live && <p className="text-px-xp">The council is still working. Results fill in as they arrive…</p>}

      <section aria-labelledby="results-council" className="flex flex-col gap-5">
        <h2 id="results-council" className="font-pixel text-xs leading-relaxed text-px-xp">THE COUNCIL</h2>
        {data.hasCouncil ? (
          <div className="grid gap-6 md:grid-cols-2">
            {data.seats.map((seat) => (
              <CouncilCard key={seat.key} seat={seat} />
            ))}
            {data.extras.map((r) => (
              <article key={r.key} className="pixel-panel flex flex-col gap-3 p-5">
                <h3 className="font-pixel text-[11px] leading-relaxed">{r.title.toUpperCase()}</h3>
                <Markdown>{r.content}</Markdown>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-px-muted">This session’s council reports weren’t saved{rerun ? '. Use re-run to regenerate them.' : '.'}</p>
        )}
      </section>

      {(data.glitch.status === 'done' || data.glitch.status === 'fainted') && (
        <PixelPanel title="TEAM GLITCH · 5 REASONS THIS FAILS" accent="glitch">
          <div className="mb-5 flex flex-wrap items-end gap-4">
            {TEAM_GLITCH.members.map((m) => (
              <Sprite key={m.name} name={m.sprite} size={64} />
            ))}
            <p className="text-[24px]">“{TEAM_GLITCH.motto}”</p>
          </div>
          {data.glitch.status === 'done' && data.glitch.report ? (
            <Markdown>{data.glitch.report.content}</Markdown>
          ) : (
            <p className="text-px-glitch-text">Team Glitch blasted off before finishing their critique.</p>
          )}
        </PixelPanel>
      )}

      <section aria-labelledby="results-plan" className="flex flex-col gap-5">
        <h2 id="results-plan" className="font-pixel text-xs leading-relaxed text-px-xp">THE MASTERPLAN</h2>
        {data.planStatus === 'failed' && <p className="text-px-glitch-text">The trainers dropped the plan: the synthesis came back empty.</p>}
        {sections.map((s, i) => (
          <article key={`${i}-${s.heading}`} className="pixel-panel flex flex-col gap-5 p-6 md:flex-row">
            <div className="flex shrink-0 flex-row items-center gap-3 md:w-28 md:flex-col">
              <div className="border-4 border-px-ink bg-px-screen p-1">
                <Sprite name={s.trainer.sprite} size={64} />
              </div>
              <span className="font-pixel text-[10px]">{s.trainer.name.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              {s.heading && <h3 className="mb-3 font-pixel text-xs leading-relaxed text-px-screen">{s.heading}</h3>}
              <Markdown>{s.body}</Markdown>
            </div>
          </article>
        ))}
        {data.planStatus === 'writing' && <p className="text-px-muted">The trainers are still writing…</p>}
      </section>

      {footer}
    </div>
  )
}
