import { useState, useEffect } from 'react'
// @ts-ignore
import { useAuth, useClerk, UserButton } from '@clerk/clerk-react'
import { useSessionStore } from '../store/sessionStore'
import { EpisodePlayer } from './council/EpisodePlayer'
import { Results } from './council/Results'
import { BattleScreen } from './chat/BattleScreen'
import { EvolutionScene } from './chat/EvolutionScene'
import { resultsFromEpisode, resultsFromSession } from '../episode/results'
import { canReplay } from '../episode/replay'
import { PixelButton } from '../pixel/ui/PixelButton'

import { FollowUpEmailCapture } from './FollowUpEmailCapture'
import { CLERK_ENABLED } from '../lib/auth'

function SessionAuthButton() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!CLERK_ENABLED || !isLoaded) return null
  if (isSignedIn) return (
    <div className="flex-shrink-0">
      <UserButton afterSignOutUrl="/" />
    </div>
  )
  return (
    <PixelButton variant="secondary" size="sm" className="shrink-0" onClick={() => openSignIn()}>
      SIGN IN
    </PixelButton>
  )
}

function SaveNudge() {
  // @ts-ignore
  const { isSignedIn, isLoaded } = useAuth()
  // @ts-ignore
  const { openSignIn } = useClerk()
  if (!CLERK_ENABLED || !isLoaded || isSignedIn) return null
  return (
    <button
      type="button"
      onClick={() => openSignIn()}
      className="w-full border-[3px] border-dashed border-px-xp-dark px-4 py-2 text-center font-term text-[20px] text-px-xp hover:border-px-xp focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan"
    >
      ⚠ This session isn’t saved. Sign in to keep your progress ▶
    </button>
  )
}

const BILLING_ENABLED = !!import.meta.env.VITE_RAZORPAY_KEY_ID

function DonationCard({ onDismiss }: { onDismiss: () => void }) {
  const { session, createCheckout } = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [donated, setDonated] = useState(false)

  if (!BILLING_ENABLED || !session) return null

  const handleDonate = async () => {
    setLoading(true)
    const url = await createCheckout()
    if (url) {
      window.location.href = url
    } else {
      setDonated(true)
      setLoading(false)
    }
  }

  if (donated) return null

  return (
    <div className="rounded-2xl border fade-up"
      style={{ borderColor: 'rgba(52,211,153,0.12)', background: 'rgba(52,211,153,0.02)' }}>
      <div className="px-6 py-5 flex items-start gap-4">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink-200 mb-1">Socra is free. Support it if it helped.</p>
          <p className="text-[12px] text-ink-600 leading-relaxed">
            No paywall, no lock-in. If this analysis helped you think more clearly about your idea, a ₹499 donation keeps the LLM costs covered.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleDonate}
              disabled={loading}
              className="px-4 py-2 rounded-xl font-mono text-[12px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.25)',
                color: 'rgba(52,211,153,0.9)',
              }}
            >
              {loading ? 'Redirecting…' : 'Donate ₹499'}
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-xl font-mono text-[12px] transition-all"
              style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SessionPage() {
  const [view, setView] = useState<'chat' | 'results'>('chat')
  const {
    session, isSending, streamingMessage, currentChoices, isUnlocking,
    streamError, savedFlash, lastSentMessage, isAdmin, lastPipeline,
    pipelinePreference, setPipelinePreference,
    episode, episodeOpen, skipEpisode, closeEpisode, replayEpisode, retryEpisode,
    evolution, dismissEvolution,
    sendMessage, updateAssumptionStatus, clearSession, devUnlock, devRerunMasterplan, devSeedConversation,
  } = useSessionStore()
  const showDev = isAdmin || !BILLING_ENABLED
  const [showDonation, setShowDonation] = useState(true)
  const episodeLive = !!episode && episode.beat !== 'done' && episode.beat !== 'failed'

  // Land on results when the masterplan arrives, or when a running episode is skipped
  useEffect(() => {
    if (session?.masterplan) setView('results')
  }, [!!session?.masterplan])
  useEffect(() => {
    if (episode?.skipped) setView('results')
  }, [episode?.skipped])

  if (!session) return null

  // A skipped live episode shows its partial results until the saved session arrives
  const hasResults = !!session.masterplan || (episodeLive && !!episode?.skipped)
  const resultsData = episodeLive && episode ? resultsFromEpisode(episode) : resultsFromSession(session)
  const devLabel = (text: string) => `${isAdmin ? '[ADMIN]' : '[DEV]'} ${text}`

  return (
    <div className="flex min-h-screen flex-col bg-px-night font-term text-px-screen">
      {episodeOpen && episode && (
        <EpisodePlayer episode={episode} onSkip={skipEpisode} onClose={closeEpisode} onRetry={retryEpisode} />
      )}
      {evolution && <EvolutionScene evolution={evolution} onClose={dismissEvolution} />}

      {/* Unlock in progress: only until the episode starts (not after Skip) */}
      {isUnlocking && !episodeOpen && !episodeLive && (
        <div role="status" className="fixed inset-0 z-40 flex items-center justify-center bg-px-night/90">
          <p className="pixel-dialog px-6 py-4 text-[26px] text-px-ink">
            The council is gathering<span aria-hidden="true" className="pixel-blink">…</span>
          </p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b-4 border-px-edge bg-px-night">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2 pt-3 sm:gap-4 sm:px-6">
          <span className="shrink-0 font-pixel text-[11px] text-px-xp">SOCRA</span>
          <p className="min-w-0 flex-1 truncate text-[20px] text-px-muted">{session.initial_idea}</p>
          <PixelButton variant="secondary" size="sm" className="shrink-0" onClick={clearSession}>
            ← NEW
          </PixelButton>
          <SessionAuthButton />
        </div>
        {hasResults && (
          <nav aria-label="Session views" className="mx-auto flex max-w-5xl gap-2 px-4 sm:px-6">
            {(['chat', 'results'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-current={view === v ? 'page' : undefined}
                onClick={() => setView(v)}
                className={`border-b-4 px-3 py-1 font-pixel text-[10px] leading-relaxed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-px-plan ${
                  view === v ? 'border-px-xp text-px-xp' : 'border-transparent text-px-muted hover:text-px-screen'
                }`}
              >
                {v === 'chat' ? 'CHAT' : 'RESULTS'}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ── VIEW: RESULTS ─────────────────────────────────────── */}
      {view === 'results' && hasResults && (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
          <Results
            sessionId={session.id}
            idea={session.initial_idea}
            data={resultsData}
            canReplay={canReplay(session) && !episodeLive}
            onReplay={replayEpisode}
            rerun={showDev ? {
              onClick: () => devRerunMasterplan(pipelinePreference === 'langgraph'),
              busy: isUnlocking || episodeLive,
              label: devLabel('RE-RUN'),
            } : undefined}
            pipeline={lastPipeline}
            footer={
              <>
                <FollowUpEmailCapture sessionId={session.id} />
                {showDonation && <DonationCard onDismiss={() => setShowDonation(false)} />}
              </>
            }
          />
        </main>
      )}

      {/* ── VIEW: CHAT (default) ───────────────────────────────── */}
      {view === 'chat' && (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          <BattleScreen
            session={session}
            isSending={isSending}
            streaming={streamingMessage}
            choices={currentChoices}
            pendingAnswer={lastSentMessage}
            streamError={streamError}
            savedFlash={savedFlash}
            onSend={(text) => sendMessage(text)}
            onRetry={lastSentMessage ? () => sendMessage(lastSentMessage) : undefined}
            onCycleAssumption={updateAssumptionStatus}
            extras={
              <>
                <SaveNudge />
                {/* Dev/admin shortcuts: skip straight to the masterplan, or auto-play a full conversation */}
                {showDev && !session.masterplan && !episodeLive && !isSending && (
                  <div className="flex flex-wrap items-center gap-2">
                    <PixelButton
                      variant="secondary"
                      size="sm"
                      aria-pressed={pipelinePreference === 'langgraph'}
                      onClick={() => setPipelinePreference(pipelinePreference === 'langgraph' ? 'legacy' : 'langgraph')}
                    >
                      {pipelinePreference === 'langgraph' ? '⬡ LANGGRAPH' : '◎ LEGACY'}
                    </PixelButton>
                    <PixelButton
                      variant="secondary"
                      size="sm"
                      disabled={isUnlocking}
                      onClick={() => devUnlock(pipelinePreference === 'langgraph')}
                    >
                      {isUnlocking ? '…' : devLabel('SKIP TO MASTERPLAN')}
                    </PixelButton>
                    <PixelButton
                      variant="secondary"
                      size="sm"
                      disabled={isUnlocking}
                      title="Auto-play a realistic founder conversation, then generate the masterplan (for testing quality)"
                      onClick={() => devSeedConversation()}
                    >
                      {isUnlocking ? '…' : devLabel('QUICK-FILL')}
                    </PixelButton>
                  </div>
                )}
              </>
            }
          />
        </main>
      )}
    </div>
  )
}
