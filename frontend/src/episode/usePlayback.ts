import { useCallback, useEffect, useRef, useState } from 'react'
import { createEpisodeController, type EpisodeController } from './controller'
import type { EpisodeState } from './reducer'
import { canReplay, replayEvents } from './replay'

type Replayable = Parameters<typeof replayEvents>[0]

/**
 * Episode replay for pages outside the session store (the public /share page): the same
 * controller and pacing the store uses for "Watch episode".
 */
export function usePlayback() {
  const [episode, setEpisode] = useState<EpisodeState | null>(null)
  const [open, setOpen] = useState(false)
  const controller = useRef<EpisodeController | null>(null)

  useEffect(() => () => controller.current?.dispose(), [])

  const play = useCallback((session: Replayable) => {
    if (!canReplay(session)) return
    controller.current?.dispose()
    const c = createEpisodeController({ mode: 'replay', onChange: setEpisode })
    controller.current = c
    setEpisode(c.state)
    setOpen(true)
    replayEvents(session).forEach((e) => c.push(e))
  }, [])

  const skip = useCallback(() => {
    controller.current?.skip()
    setOpen(false)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { episode, open, play, skip, close }
}
