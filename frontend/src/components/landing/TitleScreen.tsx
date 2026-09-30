import { forwardRef } from 'react'
import { PROFESSOR } from '../../pixel/cast'
import { DialogBox } from '../../pixel/ui/DialogBox'
import { MenuChoice } from '../../pixel/ui/MenuChoice'
import { PixelButton } from '../../pixel/ui/PixelButton'

// The only ideas STUB_MODE answers: keep these strings exactly as the backend expects
export const EXAMPLES = [
  'A SaaS platform where developers can collaboratively review and annotate API documentation',
  'A marketplace for freelance ML engineers to bid on short-term data labeling contracts',
  'A mobile app that tracks grocery prices across local stores using receipt scanning',
]

interface TitleScreenProps {
  idea: string
  onIdeaChange: (idea: string) => void
  onStart: () => void
  onExample: (idea: string) => void
  loading: boolean
  error: string | null
}

/** The game's title screen: logo, headline, Prof. Socra, and NAME YOUR IDEA. */
export const TitleScreen = forwardRef<HTMLTextAreaElement, TitleScreenProps>(function TitleScreen(
  { idea, onIdeaChange, onStart, onExample, loading, error },
  ref,
) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-5 text-center">
        <p
          aria-hidden="true"
          className="font-pixel text-[32px] leading-none text-px-xp [text-shadow:4px_4px_0_theme(colors.px.xp-dark)] sm:text-[48px]"
        >
          SOCRA
        </p>
        <h1 className="max-w-2xl text-[36px] leading-[1.05] text-px-screen sm:text-[48px]">
          <span className="sr-only">Socra: </span>
          We kill <span className="text-px-xp">bad ideas</span> before they kill you.
        </h1>
        <p className="max-w-xl text-px-soft">ChatGPT tells you how to build it. Socra tells you if you should.</p>
      </div>

      <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
        {PROFESSOR.line} Tell me your idea.
      </DialogBox>

      <section aria-labelledby="name-your-idea" className="pixel-panel flex flex-col gap-4 p-4 sm:p-6">
        <label id="name-your-idea" htmlFor="idea-box" className="font-pixel text-[11px] leading-relaxed text-px-xp">
          NAME YOUR IDEA
        </label>
        <textarea
          id="idea-box"
          ref={ref}
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onStart()
            }
          }}
          placeholder="I want to build a platform where…"
          rows={3}
          className="min-h-[96px] w-full resize-none border-[3px] border-px-edge bg-px-night px-3 py-2 text-[22px] leading-snug text-px-screen placeholder:text-px-muted focus:border-px-xp focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[20px] text-px-muted">Free · no account needed · ⇧↵ new line</span>
          <PixelButton disabled={!idea.trim() || loading} onClick={onStart}>
            {loading ? 'LOADING…' : 'PRESS START ▶'}
          </PixelButton>
        </div>
        {error && <p role="alert" className="text-px-glitch-text">{error}</p>}
      </section>

      <nav aria-label="Example ideas" className="flex flex-col gap-2">
        <h2 className="font-pixel text-[10px] leading-relaxed text-px-muted">TRY AN EXAMPLE</h2>
        <ul className="flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <MenuChoice className="w-full" onClick={() => onExample(ex)}>{ex}</MenuChoice>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
})
