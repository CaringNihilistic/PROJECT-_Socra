import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/chatSession.json'
import { STAGES } from '../../pixel/cast'
import {
  FALLBACK_PROMPT,
  STAT_ROWS,
  dialogLine,
  evolutionFor,
  evolutionToFinal,
  logTurns,
  stageForSession,
  visibleTurns,
  type Turn,
} from '../turns'

const debate = fixture.debate as { conversation_history: Turn[]; scores: Record<string, number>; phase: string }
const [egg, hatchling, evolved, final] = STAGES
const idle = { isSending: false, streaming: '', choices: [] as string[] }

describe('visibleTurns', () => {
  it('drops empty and markdown-only turns', () => {
    const turns = visibleTurns([
      { role: 'user', content: 'A real answer' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: '**  --- ##' },
      { role: 'assistant', content: 'Why now?' },
    ])
    expect(turns.map((t) => t.content)).toEqual(['A real answer', 'Why now?'])
  })

  it('keeps every turn of a real interrogation', () => {
    expect(visibleTurns(debate.conversation_history)).toHaveLength(6)
  })
})

describe('dialogLine', () => {
  it('shows the latest question', () => {
    const line = dialogLine({ history: debate.conversation_history, ...idle })
    expect(line).toEqual({ kind: 'question', text: debate.conversation_history[5].content })
  })

  it('streams the reply while sending, and waits before the first token', () => {
    const history = debate.conversation_history
    expect(dialogLine({ history, ...idle, isSending: true })).toEqual({ kind: 'waiting' })
    expect(dialogLine({ history, ...idle, isSending: true, streaming: 'Good.' })).toEqual({ kind: 'streaming', text: 'Good.' })
  })

  it('falls back to a prompt when Part 1 came back empty but choices exist', () => {
    const history: Turn[] = [...debate.conversation_history, { role: 'user', content: 'Tone templates' }, { role: 'assistant', content: '' }]
    expect(dialogLine({ history, ...idle, choices: ['a'] })).toEqual({ kind: 'fallback', text: FALLBACK_PROMPT })
    // without choices it keeps showing the last real question
    expect(dialogLine({ history, ...idle }).kind).toBe('question')
  })

  it('introduces Socra before any question', () => {
    expect(dialogLine({ history: [{ role: 'user', content: 'An app for dog walkers' }], ...idle })).toEqual({ kind: 'intro' })
  })
})

describe('logTurns', () => {
  it('excludes the question the dialog shows', () => {
    const history = debate.conversation_history
    const log = logTurns(history, dialogLine({ history, ...idle }))
    expect(log).toHaveLength(5)
    expect(log).not.toContain(history[5])
    expect(log[0]).toBe(history[0])
  })

  it('keeps the previous question in the log while the next one streams', () => {
    const history = debate.conversation_history
    expect(logTurns(history, { kind: 'streaming', text: 'x' })).toHaveLength(6)
  })
})

describe('stages and evolution', () => {
  it('has a label for every scored dimension', () => {
    expect(STAT_ROWS.map((r) => r.key).sort()).toEqual(Object.keys(debate.scores).sort())
  })

  it('maps a session to its stage, with the masterplan winning', () => {
    expect(stageForSession({ phase: 'debate' })).toBe(hatchling)
    expect(stageForSession({ phase: 'mystery' })).toBe(egg)
    expect(stageForSession({ phase: 'intake', masterplan: '# plan' })).toBe(final)
  })

  it('evolves only forwards, and a double jump plays once', () => {
    expect(evolutionFor(egg, hatchling)).toEqual({ from: egg, to: hatchling })
    expect(evolutionFor(egg, evolved)).toEqual({ from: egg, to: evolved })
    expect(evolutionFor(hatchling, hatchling)).toBeNull()
    expect(evolutionFor(evolved, hatchling)).toBeNull()
  })

  it('evolves to Final Form when the council starts, unless already there', () => {
    expect(evolutionToFinal(evolved)).toEqual({ from: evolved, to: final })
    expect(evolutionToFinal(final)).toBeNull()
  })

  it('the fixture crossed 40% into the Hatchling stage', () => {
    expect(evolutionFor(stageForSession(fixture.intake), stageForSession(fixture.debate))).toEqual({ from: egg, to: hatchling })
  })
})
