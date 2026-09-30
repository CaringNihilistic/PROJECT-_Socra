import { useEffect, useState } from 'react'
import axios from 'axios'
import type { SessionData } from '../store/sessionStore'
import { canReplay } from '../episode/replay'
import { resultsFromSession } from '../episode/results'
import { usePlayback } from '../episode/usePlayback'
import { PROFESSOR } from '../pixel/cast'
import { DialogBox } from '../pixel/ui/DialogBox'
import { EpisodePlayer } from './council/EpisodePlayer'
import { Results } from './council/Results'
import { Loading, NotFound, PublicShell, RunYourIdea } from './share/ShareChrome'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** A shared masterplan, read-only, with the council episode replayable. */
export function SharedResults({ session }: { session: SessionData }) {
  const playback = usePlayback()
  return (
    <>
      {playback.open && playback.episode && (
        <EpisodePlayer episode={playback.episode} onSkip={playback.skip} onClose={playback.close} />
      )}
      <Results
        sessionId={session.id}
        idea={session.initial_idea}
        data={resultsFromSession(session)}
        canReplay={canReplay(session)}
        onReplay={() => playback.play(session)}
        footer={
          <section className="flex flex-col items-start gap-5">
            <DialogBox speaker={PROFESSOR.name.toUpperCase()} sprite={PROFESSOR.sprite}>
              Think your idea survives the council? I’m waiting.
            </DialogBox>
            <RunYourIdea label="PRESS START ▶" />
          </section>
        }
      />
    </>
  )
}

export function SharePage({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    axios
      .get<SessionData>(`${API_URL}/sessions/${sessionId}`)
      .then(({ data }) => {
        setSession(data)
        setState(data.masterplan ? 'ready' : 'missing')
      })
      .catch(() => setState('missing'))
  }, [sessionId])

  return (
    <PublicShell section="MASTERPLAN">
      {state === 'loading' && <Loading what="MASTERPLAN" />}
      {state === 'missing' && <NotFound message="This masterplan doesn’t exist, or isn’t finished yet." />}
      {state === 'ready' && session && <SharedResults session={session} />}
    </PublicShell>
  )
}
