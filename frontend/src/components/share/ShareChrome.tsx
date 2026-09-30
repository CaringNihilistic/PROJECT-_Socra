import type { ReactNode } from 'react'
import { PROFESSOR } from '../../pixel/cast'
import { DialogBox } from '../../pixel/ui/DialogBox'

const linkBtn =
  'pixel-btn pixel-btn-primary pixel-btn-sm inline-flex items-center whitespace-nowrap focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-px-plan'

/** A link styled as the primary pixel button (navigation, so an <a>, not a <button>). */
export function RunYourIdea({ label = 'RUN YOUR IDEA ▶' }: { label?: string }) {
  return (
    <a href="/" className={linkBtn}>
      {label}
    </a>
  )
}

/** Page shell for the public pages: pixel header with the section name and a way in. */
export function PublicShell({ section, children }: { section: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-px-night font-term text-[22px] text-px-screen">
      <header className="sticky top-0 z-20 border-b-4 border-px-edge bg-px-night">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="font-pixel text-[11px] text-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan">
            SOCRA
          </a>
          <span className="hidden font-pixel text-[10px] text-px-muted sm:inline">/ {section}</span>
          <span className="ml-auto">
            <RunYourIdea />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  )
}

export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="py-20 text-center text-px-muted">
      LOADING {what}
      <span aria-hidden="true" className="pixel-blink">…</span>
    </p>
  )
}

/** Not found: Prof. Socra says so, with a way back to the start. */
export function NotFound({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 py-10">
      <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
        {message}
      </DialogBox>
      <RunYourIdea />
    </div>
  )
}
