import { useCallback, useRef, useState } from 'react'
// @ts-ignore
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react'
import { useSessionStore } from '../store/sessionStore'
import { CLERK_ENABLED } from '../lib/auth'
import { PixelButton } from '../pixel/ui/PixelButton'
import { TitleScreen } from './landing/TitleScreen'
import { TitleScene } from './landing/TitleScene'
import { GroundFooter } from './landing/GroundFooter'
import { ContinueMenu } from './landing/ContinueMenu'
import { JourneyDemo } from './landing/JourneyDemo'
import { HowItPlays } from './landing/HowItPlays'
import { CastRoster } from './landing/CastRoster'
import { FreeToPlay, GetUpdates, SaysNo } from './landing/ManualSections'

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

const NAV = [
  { href: '#how', label: 'HOW IT PLAYS' },
  { href: '#cast', label: 'CAST' },
  { href: '#free', label: 'FREE' },
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
    document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    box.current?.focus({ preventScroll: true })
  }, [])

  const compare = (id: string) => {
    if (compareId === id) setCompareId(null)
    else if (compareId) window.location.href = `/compare/${compareId}/${id}`
    else setCompareId(id)
  }

  return (
    <div className="min-h-screen bg-px-night font-term text-[22px] text-px-screen">
      <a href="#start" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-px-xp focus:px-3 focus:py-1 focus:text-px-ink">
        Skip to the idea box
      </a>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-4 border-px-edge bg-px-night">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <a href="#start" className="font-pixel text-[11px] text-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan">SOCRA</a>
          <nav aria-label="Sections" className="hidden flex-1 gap-5 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="font-pixel text-[10px] text-px-muted hover:text-px-screen focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {CLERK_ENABLED && <AuthButton />}
            <PixelButton size="sm" onClick={focusStart}>START ▶</PixelButton>
          </div>
        </div>
      </header>

      {/* ── Title screen: full width, so the scenery can fill the gutters ── */}
      <TitleScene>
        <div id="start" className="mx-auto flex w-full max-w-3xl scroll-mt-24 flex-col gap-10">
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
          <ContinueMenu
            sessions={sessionHistory}
            compareId={compareId}
            loading={isLoading}
            onResume={resumeSession}
            onCompare={compare}
            nudge={CLERK_ENABLED ? <SyncNudge /> : undefined}
          />
        </div>
      </TitleScene>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
        <div id="demo" className="scroll-mt-24">
          <JourneyDemo onStart={focusStart} />
        </div>
        <HowItPlays />
        <CastRoster />
        <SaysNo />
        <FreeToPlay onStart={focusStart} />
        <GetUpdates apiUrl={API_URL} />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <GroundFooter>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pb-8 pt-6 text-[20px] text-px-soft sm:px-6">
          <span><span className="font-pixel text-[10px] text-px-xp">SOCRA</span> · © 2026 · Built in India</span>
          <a href={REPO_URL} className="text-px-screen hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan">
            GitHub ▶
          </a>
        </div>
      </GroundFooter>
    </div>
  )
}
