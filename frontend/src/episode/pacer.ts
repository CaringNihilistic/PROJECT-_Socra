/**
 * Releases episode events no faster than their beat gaps. Pacing only delays what is
 * shown; it never slows the backend. Consecutive plan tokens with a 0ms gap are merged
 * into one release so a fast stream doesn't re-render per token.
 */
import type { EpisodeEvent } from './events'

export type GapRule = (prev: EpisodeEvent | null, next: EpisodeEvent) => number

export interface Pacer {
  push(event: EpisodeEvent): void
  /** Release everything queued now and stop pacing from here on. */
  skip(): void
  dispose(): void
}

function mergeTokens(batch: EpisodeEvent[]): EpisodeEvent[] {
  const merged: EpisodeEvent[] = []
  for (const e of batch) {
    const last = merged[merged.length - 1]
    if (e.type === 'synthesis_token' && last?.type === 'synthesis_token') {
      merged[merged.length - 1] = { type: 'synthesis_token', delta: last.delta + e.delta }
    } else {
      merged.push(e)
    }
  }
  return merged
}

export function createPacer({ gapMs, onRelease }: { gapMs: GapRule; onRelease: (batch: EpisodeEvent[]) => void }): Pacer {
  let queue: EpisodeEvent[] = []
  let prev: EpisodeEvent | null = null
  let lastReleaseAt = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let skipped = false
  let disposed = false

  const release = (batch: EpisodeEvent[]) => {
    prev = batch[batch.length - 1]
    lastReleaseAt = Date.now()
    onRelease(mergeTokens(batch))
  }

  const releaseNext = () => {
    timer = null
    if (disposed || !queue.length) return
    const batch = [queue.shift() as EpisodeEvent]
    // Merge following plan tokens that would be released with no gap anyway
    while (batch[0].type === 'synthesis_token' && queue[0]?.type === 'synthesis_token' && gapMs(batch[batch.length - 1], queue[0]) === 0) {
      batch.push(queue.shift() as EpisodeEvent)
    }
    release(batch)
    schedule()
  }

  const schedule = () => {
    if (timer || disposed || !queue.length) return
    if (skipped) {
      release(queue)
      queue = []
      return
    }
    const wait = Math.max(0, lastReleaseAt + gapMs(prev, queue[0]) - Date.now())
    timer = setTimeout(releaseNext, wait)
  }

  return {
    push(event) {
      if (disposed) return
      queue.push(event)
      schedule()
    },
    skip() {
      skipped = true
      if (timer) clearTimeout(timer)
      timer = null
      schedule()
    },
    dispose() {
      disposed = true
      if (timer) clearTimeout(timer)
      timer = null
      queue = []
    },
  }
}
