/**
 * Dev-only: plays the Council episode from a real saved session, without the backend.
 * Served at /__episode when running `npm run dev` (routed in App.tsx behind import.meta.env.DEV).
 */
import { useEffect, useRef, useState } from 'react'
import sample from '../../episode/__fixtures__/sampleSession.json'
import { createEpisodeController, type EpisodeController } from '../../episode/controller'
import { replayEvents } from '../../episode/replay'
import { resultsFromSession } from '../../episode/results'
import type { AgentReport, EpisodeEvent } from '../../episode/events'
import type { EpisodeState } from '../../episode/reducer'
import { PixelButton } from '../../pixel/ui/PixelButton'
import { EpisodePlayer } from './EpisodePlayer'
import { Results } from './Results'

const session = sample as { id: string; initial_idea: string; masterplan: string; agent_reports: AgentReport[] }

/** A fake live run: reports at uneven times (two pairs land together), the plan in small tokens. */
function liveSchedule(): [number, EpisodeEvent][] {
  const devil = session.agent_reports.find((r) => r.key === 'devils_advocate')
  const council = session.agent_reports.filter((r) => r !== devil)
  const schedule: [number, EpisodeEvent][] = [
    [0, { type: 'web_research', queries: ['api docs collaboration market size funding 2024', 'api docs startup regulations risks compliance'] }],
  ]
  const offsets = [2200, 2250, 4100, 6500, 6550]
  council.forEach((report, i) => schedule.push([offsets[i] ?? 7000, { type: 'agent_report', report }]))
  let t = 8000
  for (let i = 0; i < session.masterplan.length; i += 24) {
    schedule.push([t, { type: 'synthesis_token', delta: session.masterplan.slice(i, i + 24) }])
    t += 18
  }
  schedule.push([t, { type: 'synthesis_done', text: session.masterplan }])
  if (devil) schedule.push([t + 2500, { type: 'agent_report', report: devil }])
  schedule.push([t + 3200, { type: 'done' }])
  return schedule
}

export function EpisodeDemo() {
  const [episode, setEpisode] = useState<EpisodeState | null>(null)
  const [open, setOpen] = useState(false)
  const ctrl = useRef<EpisodeController | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const stop = () => {
    ctrl.current?.dispose()
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => stop, [])

  const play = (mode: 'live' | 'replay') => {
    stop()
    const c = createEpisodeController({ mode, onChange: setEpisode })
    ctrl.current = c
    setEpisode(c.state)
    setOpen(true)
    if (mode === 'replay') replayEvents(session).forEach((e) => c.push(e))
    else timers.current = liveSchedule().map(([ms, e]) => setTimeout(() => c.push(e), ms))
  }

  return (
    <main className="min-h-screen bg-px-night px-6 py-10 font-term text-[22px] text-px-screen">
      {open && episode && (
        <EpisodePlayer
          episode={episode}
          onSkip={() => {
            ctrl.current?.skip()
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
          onRetry={() => play('live')}
        />
      )}
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-[20px] text-px-muted">DEV ONLY · /__episode</p>
          <h1 className="font-pixel text-lg leading-relaxed text-px-xp">Council episode demo</h1>
          <p className="text-px-soft">
            A real saved session from production, played through the same engine the app uses. “Simulate live run” feeds
            events at uneven times (two pairs of reports land together) to show the pacing.
          </p>
          <div className="flex flex-wrap gap-3">
            <PixelButton onClick={() => play('live')}>▶ SIMULATE LIVE RUN</PixelButton>
            <PixelButton variant="secondary" onClick={() => play('replay')}>▶ REPLAY</PixelButton>
          </div>
        </header>
        <Results
          sessionId={session.id}
          idea={session.initial_idea}
          data={resultsFromSession(session)}
          canReplay
          onReplay={() => play('replay')}
        />
      </div>
    </main>
  )
}
