/**
 * One server-sent-events reader for every Socra stream. Replaces four copy-pasted
 * loops in the store (two of which split events differently).
 */

/**
 * Split buffered stream text into complete events. Events end at a blank line; an
 * event's `data:` lines are joined with newlines. Malformed JSON is skipped. Whatever
 * follows the last blank line is returned as `rest` to prepend to the next chunk.
 */
export function splitEvents(buffer: string): { events: unknown[]; rest: string } {
  const blocks = buffer.replace(/\r\n?/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  const events: unknown[] = []
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
    if (!data) continue
    try {
      events.push(JSON.parse(data))
    } catch {
      // A malformed event must not kill the whole stream
    }
  }
  return { events, rest }
}

/**
 * Read a `text/event-stream` body to the end, calling `onEvent` with each parsed
 * payload. `onChunk` fires on every network chunk (used for inactivity timeouts).
 */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (payload: unknown) => void,
  onChunk?: () => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk?.()
    const { events, rest } = splitEvents(buffer + decoder.decode(value, { stream: true }))
    buffer = rest
    events.forEach(onEvent)
  }
  // Flush a final event the server closed without a trailing blank line
  splitEvents(buffer + decoder.decode() + '\n\n').events.forEach(onEvent)
}
