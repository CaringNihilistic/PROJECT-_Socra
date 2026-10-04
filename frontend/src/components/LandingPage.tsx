import { useCallback, useRef, useState } from 'react'
// @ts-ignore
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react'
import { useSessionStore } from '../store/sessionStore'
import { CLERK_ENABLED } from '../lib/auth'
import { Arrow, PixelButton } from '../pixel/ui/PixelButton'
import { TitleScreen } from './landing/TitleScreen'
import { TitleScene } from './landing/TitleScene'
import { GroundFooter } from './landing/GroundFooter'
import { ContinueMenu } from './landing/ContinueMenu'
import { JourneyDemo } from './landing/JourneyDemo'
import { HowItPlays } from './landing/HowItPlays'
import { CastRoster } from './landing/CastRoster'
import { FinalCta, GetUpdates } from './landing/ManualSections'
import { GlitchBand } from './landing/GlitchBand'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000'
const REPO_URL = 'https://github.com/CaringNihilistic/PROJECT-_Socra'

// ─── Auth helpers (need ClerkProvider, so only rendered when Clerk is enabled) ───

function AuthButton() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!isLoaded) return null
  if (isSignedIn) return <UserButton afterSignOutUrl="/" />
  return (
    <PixelButton variant="secondary" size="sm" onClick={() => openSignIn()}>
      SIGN IN
    </PixelButton>
  )
}

function SyncNudge() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!isLoaded || isSignedIn) return null
  return (
    <button
      type="button"
      onClick={() => openSignIn()}
      className="text-[20px] text-px-xp hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan"
    >
      Sign in to sync your saves ▶
    </button>
  )
}

const ring = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-px-plan'

// Links are at least 44px tall, so they are easy to hit with a thumb
const tap = 'inline-flex min-h-[44px] items-center'
const wrap = 'mx-auto w-full max-w-[1240px] px-5 sm:px-8'

const NAV = [
  { href: '#cast', label: 'CAST' },
  { href: '#how', label: 'HOW IT PLAYS' },
]

export function LandingPage() {
  const [idea, setIdea] = useState('')
  // Compare flow: the first selected session (pre-seeded from ?compare=)
  const [compareId, setCompareId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('compare'))
  const box = useRef<HTMLTextAreaElement>(null)
  const { createSession, isLoading, sessionError, sessionHistory, resumeSession } = useSessionStore()

  const start = async () => {
    const trimmed = idea.trim()
    if (!trimmed || isLoading) return
    await createSession(trimmed)
  }

  /** Back to the idea box from anywhere on the page. */
  const focusStart = useCallback(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.getElementById('start')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    box.current?.focus({ preventScroll: true })
  }, [])

  const compare = (id: string) => {
    if (compareId === id) setCompareId(null)
    else if (compareId) window.location.href = `/compare/${compareId}/${id}`
    else setCompareId(id)
  }

  return (
    <div className="min-h-screen bg-px-night font-term text-[24px] text-px-screen">
      <a href="#idea-box" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-px-xp focus:px-3 focus:py-1 focus:text-px-ink focus:outline focus:outline-[3px] focus:outline-offset-2 focus:outline-px-plan">
        Skip to the idea box
      </a>

      {/* ── Nav: compact and quiet, so the hero's button is the brightest thing on screen ── */}
      <header className="sticky top-0 z-50 border-b-2 border-px-edge bg-px-night">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-5 py-1 sm:gap-6 sm:px-8">
          <a href="#top" className={`${tap} font-pixel text-[13px] text-px-xp ${ring}`}>SOCRA</a>
          <nav aria-label="Sections" className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={`${tap} font-pixel text-[11px] text-px-muted transition-colors duration-150 hover:text-px-screen ${ring}`}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {CLERK_ENABLED && <AuthButton />}
            <PixelButton variant="secondary" size="sm" lift className="max-sm:!min-h-[44px]" onClick={focusStart}>START<Arrow /></PixelButton>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <div id="top" className="scroll-mt-16">
        <TitleScene>
          <TitleScreen
            ref={box}
            idea={idea}
            onIdeaChange={setIdea}
            onStart={start}
            onExample={(ex) => {
              setIdea(ex)
              box.current?.focus()
            }}
            loading={isLoading}
            error={sessionError}
          />
        </TitleScene>
      </div>

      {/* Full-bleed sections; `wrap` keeps their content on the page's 1240px column */}
      <main className="flex flex-col gap-20 pb-16 pt-10 sm:gap-28 sm:pb-20">
        {/* Only for returning visitors */}
        {sessionHistory.length > 0 && (
          <div className={wrap}>
            <ContinueMenu
              sessions={sessionHistory}
              compareId={compareId}
              loading={isLoading}
              onResume={resumeSession}
              onCompare={compare}
              nudge={CLERK_ENABLED ? <SyncNudge /> : undefined}
            />
          </div>
        )}
        <div id="demo" className={`${wrap} scroll-mt-20`}>
          <JourneyDemo onStart={focusStart} />
        </div>
        <div className={wrap}>
          <CastRoster />
        </div>
        <GlitchBand />
        <div className={wrap}>
          <HowItPlays />
        </div>
        <div className={wrap}>
          <FinalCta onStart={focusStart} />
        </div>
        <div className={wrap}>
          <GetUpdates apiUrl={API_URL} />
        </div>
      </main>

      <GroundFooter>
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-x-10 gap-y-2 pb-6 pt-4 text-[20px] text-px-soft`}>
          <p>
            <span className="mr-3 font-pixel text-[12px] text-px-xp">SOCRA</span>
            We kill bad ideas before they kill you.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {[...NAV, { href: REPO_URL, label: 'GITHUB' }].map((n) => (
              <a key={n.href} href={n.href} className={`${tap} font-pixel text-[11px] text-px-screen transition-colors duration-150 hover:text-px-xp ${ring}`}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </GroundFooter>
    </div>
  )
}
