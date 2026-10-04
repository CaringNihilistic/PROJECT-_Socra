import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { PROFESSOR } from '../../pixel/cast'
import { Sprite } from '../../pixel/Sprite'
import { Arrow, PixelButton } from '../../pixel/ui/PixelButton'
import { SpeechBubble } from '../../pixel/ui/SpeechBubble'

// The only ideas STUB_MODE answers: keep these strings exactly as the backend expects
export const EXAMPLES = [
  'A SaaS platform where developers can collaboratively review and annotate API documentation',
  'A marketplace for freelance ML engineers to bid on short-term data labeling contracts',
  'A mobile app that tracks grocery prices across local stores using receipt scanning',
]

const SOCRA_LINE = `${PROFESSOR.line} Tell me your idea.`

interface TitleScreenProps {
  idea: string
  onIdeaChange: (idea: string) => void
  onStart: () => void
  onExample: (idea: string) => void
  loading: boolean
  error: string | null
}

/**
 * The hero: what Socra is, and the one place to type an idea. Prof. Socra stands beside it
 * as a character. The idea box is the only input on the page; every other "start" button
 * scrolls back here.
 */
export const TitleScreen = forwardRef<HTMLTextAreaElement, TitleScreenProps>(function TitleScreen(
  { idea, onIdeaChange, onStart, onExample, loading, error },
  ref,
) {
  const box = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => box.current as HTMLTextAreaElement)
  // The button is never greyed out: pressing it with an empty box asks for an idea instead
  const [askedEmpty, setAskedEmpty] = useState(false)

  const submit = () => {
    if (!idea.trim()) {
      setAskedEmpty(true)
      box.current?.focus()
      return
    }
    onStart()
  }

  return (
    <div className="grid items-center gap-x-12 gap-y-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-x-20">
      <div className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-4">
          <p aria-hidden="true" className="font-pixel text-[26px] leading-none text-px-xp [text-shadow:3px_3px_0_theme(colors.px.xp-dark)] sm:text-[30px]">
            SOCRA
          </p>
          <h1 className="max-w-[16ch] text-[44px] font-bold leading-[1.02] text-px-screen sm:text-[56px] lg:text-[68px]">
            <span className="sr-only">Socra: </span>
            We kill <span className="text-px-xp">bad ideas</span> before they kill you.
          </h1>
          <p className="max-w-xl text-[24px] leading-snug text-px-soft sm:text-[26px]">ChatGPT tells you how to build it. Socra tells you if you should.</p>
        </div>

        <form
          id="start"
          noValidate
          className="flex scroll-mt-24 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label htmlFor="idea-box" className="font-pixel text-[13px] leading-relaxed text-px-xp">
            WHAT’S YOUR IDEA?
          </label>
          <textarea
            id="idea-box"
            ref={box}
            value={idea}
            onChange={(e) => {
              onIdeaChange(e.target.value)
              setAskedEmpty(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="I want to build a platform where…"
            rows={4}
            aria-describedby="idea-hint"
            className="min-h-[152px] w-full resize-none border-4 border-px-muted bg-px-panel px-4 py-3 text-[26px] leading-snug text-px-screen shadow-[6px_6px_0_theme(colors.px.edge)] transition-[border-color,box-shadow] duration-150 placeholder:text-px-muted focus:border-px-xp focus:shadow-[6px_6px_0_theme(colors.px.xp-dark)] focus:outline focus:outline-[3px] focus:outline-offset-[6px] focus:outline-px-plan motion-reduce:transition-none"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p id="idea-hint" className="text-[20px] text-px-muted">Free · no account needed · ⇧↵ new line</p>
            <PixelButton type="submit" size="lg" lift disabled={loading} className="w-full sm:w-auto">
              {loading ? 'LOADING…' : <>START INTERROGATION<Arrow /></>}
            </PixelButton>
          </div>
          {askedEmpty && !idea.trim() && <p role="alert" className="text-px-xp">Type your idea first. One sentence is enough.</p>}
          {error && <p role="alert" className="text-px-glitch-text">{error}</p>}
        </form>

        <div className="flex flex-col gap-3">
          <p id="examples-label" className="font-pixel text-[11px] leading-relaxed text-px-muted">OR TRY ONE OF THESE</p>
          <ul aria-labelledby="examples-label" className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            {EXAMPLES.map((ex) => (
              <li key={ex} className="min-w-0 lg:max-w-[calc(50%-0.25rem)]">
                {/* Cut short by CSS only: the full string is the button's text, and what fills the box */}
                <button
                  type="button"
                  title={ex}
                  onClick={() => onExample(ex)}
                  className="block min-h-[44px] w-full truncate border-2 border-px-edge px-3 text-left text-[20px] text-px-soft transition-colors duration-150 hover:border-px-muted hover:bg-px-panel hover:text-px-screen focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-px-plan"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
          <a
            href="#demo"
            className="group inline-flex min-h-[44px] items-center gap-2 self-start text-[22px] text-px-soft underline decoration-px-edge decoration-2 underline-offset-4 hover:text-px-screen hover:decoration-px-muted focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-px-plan"
          >
            See how it works <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">↓</span>
          </a>
        </div>
      </div>

      {/* Prof. Socra, as a character. From tablet up he stands under his speech bubble; on
          phones he comes after the input, small, with the bubble beside him. */}
      <figure className="hidden flex-col items-start gap-7 md:flex">
        <SpeechBubble className="text-[26px] leading-snug lg:text-[28px]">{SOCRA_LINE}</SpeechBubble>
        <div className="ml-6 flex flex-col gap-3">
          <Sprite name={PROFESSOR.sprite} size={128} bob />
          <figcaption className="font-pixel text-[11px] leading-relaxed text-px-muted">
            {PROFESSOR.name.toUpperCase()} · {PROFESSOR.role.toUpperCase()}
          </figcaption>
        </div>
      </figure>
      <figure className="flex items-start gap-5 md:hidden">
        <Sprite name={PROFESSOR.sprite} size={64} bob />
        <div className="min-w-0 flex-1">
          <SpeechBubble tail="left" className="text-[22px] leading-snug">{SOCRA_LINE}</SpeechBubble>
          <figcaption className="mt-2 font-pixel text-[11px] leading-relaxed text-px-muted">{PROFESSOR.name.toUpperCase()}</figcaption>
        </div>
      </figure>
    </div>
  )
})
