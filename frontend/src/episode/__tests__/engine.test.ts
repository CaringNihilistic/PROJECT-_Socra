import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sample from '../__fixtures__/sampleSession.json'
import { splitEvents, readSse } from '../sse'
import { isFainted, signatureLine, truncate } from '../signature'
import { cleanHeading, parseSections, sectionTail } from '../sections'
import { episodeReducer, initialEpisode, type EpisodeState } from '../reducer'
import { createPacer } from '../pacer'
import { createEpisodeController, LIVE_GAPS, REPLAY_GAPS } from '../controller'
import { canReplay, replayEvents, stateFromSession } from '../replay'
import { resultsFromEpisode, resultsFromSession } from '../results'
import { toEpisodeEvent, toEpisodeEvents, type AgentReport, type EpisodeEvent } from '../events'
import { TRAINERS } from '../../pixel/cast'

const session = sample as { masterplan: string; agent_reports: AgentReport[] }
const report = (key: string, content = '- A point.'): AgentReport => ({ key, title: key, icon: '', color: '', content })
const reduceAll = (events: EpisodeEvent[], from: EpisodeState = initialEpisode()) => events.reduce(episodeReducer, from)

// ── sse ──────────────────────────────────────────────────────────────────────
describe('splitEvents', () => {
  it('parses complete events and keeps the unfinished tail', () => {
    const { events, rest } = splitEvents('data: {"type":"a"}\n\ndata: {"type":"b"}\n\ndata: {"ty')
    expect(events).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(rest).toBe('data: {"ty')
  })

  it('joins multi-line data, accepts CRLF and skips malformed JSON', () => {
    const { events } = splitEvents('data: {"type":\r\ndata: "x"}\r\n\r\ndata: {broken\n\n: comment\n\n')
    expect(events).toEqual([{ type: 'x' }])
  })
})

describe('readSse', () => {
  it('handles an event split across network chunks and a final event with no trailing blank line', async () => {
    const chunks = ['data: {"type":"tok', 'en","delta":"hi"}\n', '\ndata: {"type":"done"}']
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)))
        c.close()
      },
    })
    const seen: unknown[] = []
    let chunkCount = 0
    await readSse(body, (e) => seen.push(e), () => chunkCount++)
    expect(seen).toEqual([{ type: 'token', delta: 'hi' }, { type: 'done' }])
    expect(chunkCount).toBe(3)
  })
})

describe('toEpisodeEvents', () => {
  it('expands done into the saved plan (the backend never forwards synthesis_done)', () => {
    expect(toEpisodeEvents({ type: 'done', session: { masterplan: '# Plan' } })).toEqual([
      { type: 'synthesis_done', text: '# Plan' },
      { type: 'done' },
    ])
    expect(toEpisodeEvents({ type: 'done', session: { masterplan: null } })[0]).toEqual({ type: 'synthesis_done', text: '' })
    expect(toEpisodeEvents({ type: 'agent_report', report: report('tech') })).toHaveLength(1)
    expect(toEpisodeEvents({ type: 'token', delta: 'x' })).toEqual([])
  })
})

describe('toEpisodeEvent', () => {
  it('keeps episode events and drops chat-only ones', () => {
    expect(toEpisodeEvent({ type: 'synthesis_token', delta: 'x' })).toEqual({ type: 'synthesis_token', delta: 'x' })
    expect(toEpisodeEvent({ type: 'done', session: {} })).toEqual({ type: 'done' })
    expect(toEpisodeEvent({ type: 'token', delta: 'x' })).toBeNull()
    expect(toEpisodeEvent({ type: 'choices', choices: [] })).toBeNull()
    expect(toEpisodeEvent(null)).toBeNull()
  })
})

// ── signature ────────────────────────────────────────────────────────────────
describe('signatureLine', () => {
  it('skips the "# Title" line real reports open with and takes the first bullet', () => {
    const banker = session.agent_reports.find((r) => r.key === 'finance')!.content
    expect(banker.split('\n')[0]).toMatch(/^# /)
    expect(signatureLine(banker)).toMatch(/^CAC: \$2,500/)
  })

  it('reads "•" bullets and strips bold labels', () => {
    expect(signatureLine('# Oracle\n• **TAM Fantasy vs. Reality**: The market is small.')).toBe(
      'TAM Fantasy vs. Reality: The market is small.',
    )
  })

  it('falls back to prose after bold-label headings (the Skeptic format)', () => {
    const skeptic = session.agent_reports.find((r) => r.key === 'risk')!.content
    expect(signatureLine(skeptic)).toMatch(/^SOC 2 Type II compliance/)
  })

  it('never exceeds the limit and cuts on a word boundary', () => {
    for (const r of session.agent_reports) expect(signatureLine(r.content).length).toBeLessThanOrEqual(120)
    expect(truncate('word '.repeat(40), 20)).toBe('word word word word…') // cut on a boundary keeps the word
    expect(truncate('abcdef ghijkl mnopqr', 16)).toBe('abcdef ghijkl…') // cut mid-word backs off
  })

  it('detects fainted agents', () => {
    expect(isFainted('_Analysis unavailable — RateLimitError_')).toBe(true)
    expect(isFainted('_Critical review could not be generated. Try again._')).toBe(true)
    expect(isFainted('   ')).toBe(true)
    expect(isFainted('- Real analysis')).toBe(false)
  })
})

// ── sections ─────────────────────────────────────────────────────────────────
describe('parseSections', () => {
  it('splits the real plan on its top-level sections, keeping sub-headings inside', () => {
    const sections = parseSections(session.masterplan)
    expect(sections.map((s) => s.heading)).toEqual([
      "CHAIRMAN'S VERDICT",
      'REFRAMED PROBLEM & SOLUTION',
      'TECH STACK',
      'PHASE 1: MVP (WEEKS 1–8)',
      'PHASE 2: GROWTH (MONTHS 3–9)',
    ])
    expect(sections[3].body).toContain('## What to Build')
    expect(sections.map((s) => s.trainer)).toEqual([TRAINERS.kai, TRAINERS.kai, TRAINERS.dex, TRAINERS.kai, TRAINERS.kai])
  })

  it('does not let a lone title swallow the plan', () => {
    const md = '# Masterplan\nIntro\n## Verdict\nA\n## Risk Register\nB'
    expect(parseSections(md).map((s) => [s.heading, s.trainer.name])).toEqual([
      ['Masterplan', 'Kai'],
      ['Verdict', 'Kai'],
      ['Risk Register', 'Marin'],
    ])
  })

  it('finds sections one level down when "#" only wraps them (a real production shape)', () => {
    const md = [
      "# CHAIRMAN'S VERDICT", 'Pass.',
      '# THE PLAY (If You Proceed Against This Advice)',
      '## Tech Stack', '| Layer | Tool |',
      '## Phase 1: MVP (Weeks 1-8)', '### What to Build', 'Matching.', '### Estimated Burn', '$9k',
      '## Phase 2: Growth (Months 3-9)', '### First 10 Paying Customers', 'Warm intros.',
      '## Risk Register', 'FERPA.',
      '## First 3 files to write', 'backend/app.py',
    ].join('\n')
    expect(parseSections(md).map((s) => [s.heading, s.trainer.name])).toEqual([
      ["CHAIRMAN'S VERDICT", 'Kai'],
      ['Tech Stack', 'Dex'], // the empty "THE PLAY" wrapper is dropped
      ['Phase 1: MVP (Weeks 1-8)', 'Kai'],
      ['Phase 2: Growth (Months 3-9)', 'Kai'],
      ['Risk Register', 'Marin'],
      ['First 3 files to write', 'Dex'],
    ])
    expect(parseSections(md)[2].body).toContain('### Estimated Burn')
  })

  it('keeps a just-arrived heading while it streams, drops empty ones behind it', () => {
    expect(parseSections('## Tech Stack\nPostgres\n## Phase 1').map((s) => s.heading)).toEqual(['Tech Stack', 'Phase 1'])
  })

  it('uses whole-line bold headings only when there are no markdown headings', () => {
    expect(parseSections('**1. Tech Stack**\nPostgres\n**Risk Register**\nFERPA').map((s) => s.heading)).toEqual([
      'Tech Stack',
      'Risk Register',
    ])
  })

  it('handles partial streamed text and empty input', () => {
    expect(parseSections('## Tech St')).toEqual([{ heading: 'Tech St', body: '', trainer: TRAINERS.kai }])
    expect(parseSections('')).toEqual([])
    expect(cleanHeading('**2. Phase 1: MVP**')).toBe('Phase 1: MVP')
  })

  it('sectionTail gives the plain-text end of a section, starting on a word', () => {
    expect(sectionTail('## Build\n- **Postgres** for data\n- Redis')).toBe('Build Postgres for data Redis')
    const tail = sectionTail('alpha beta gamma delta '.repeat(30), 40)
    expect(tail.startsWith('…')).toBe(true)
    expect(tail.length).toBeLessThanOrEqual(41)
    expect(tail.slice(1)).toMatch(/^(alpha|beta|gamma|delta) /)
  })
})

// ── reducer ──────────────────────────────────────────────────────────────────
describe('episodeReducer', () => {
  it('fills seats in any order and moves through the beats', () => {
    let s = reduceAll([{ type: 'web_research', queries: ['q1'] }])
    expect(s.beat).toBe('scouting')
    s = reduceAll([{ type: 'agent_report', report: report('risk') }, { type: 'agent_report', report: report('finance') }], s)
    expect(s.beat).toBe('council')
    expect(s.seats.find((x) => x.key === 'risk')!.status).toBe('done')
    expect(s.seats.find((x) => x.key === 'market')!.status).toBe('thinking')
    s = reduceAll([{ type: 'synthesis_token', delta: '## Ver' }, { type: 'synthesis_token', delta: 'dict' }], s)
    expect(s.beat).toBe('plan')
    expect(s.plan).toEqual({ text: '## Verdict', status: 'writing' })
    s = reduceAll([{ type: 'synthesis_done', text: '## Verdict\nFinal' }, { type: 'agent_report', report: report('devils_advocate', '1. Critique') }], s)
    expect(s.plan.status).toBe('done')
    expect(s.beat).toBe('ambush')
    expect(s.glitch.signature).toBe('Critique')
    s = reduceAll([{ type: 'done' }], s)
    expect(s.beat).toBe('done')
    expect(s.seats.filter((x) => x.status === 'fainted').map((x) => x.key)).toEqual(['market', 'competition', 'tech'])
  })

  it('starts at the council when there is no scouting (chat-triggered or no Tavily key)', () => {
    expect(reduceAll([{ type: 'agent_report', report: report('tech') }]).beat).toBe('council')
  })

  it('faints a failed agent, sends unknown keys to extras, and fails a blank plan', () => {
    const s = reduceAll([
      { type: 'agent_report', report: report('market', '_Analysis unavailable — RateLimitError_') },
      { type: 'agent_report', report: report('growth') },
      { type: 'synthesis_done', text: '  ' },
    ])
    expect(s.seats.find((x) => x.key === 'market')).toMatchObject({ status: 'fainted', signature: null })
    expect(s.extras.map((r) => r.key)).toEqual(['growth'])
    expect(s.plan.status).toBe('failed')
  })

  it('marks a missing Devil’s Advocate absent (stub mode) instead of hanging', () => {
    expect(reduceAll([{ type: 'synthesis_done', text: 'Plan' }, { type: 'done' }]).glitch.status).toBe('absent')
  })

  it('done finalises a plan whose synthesis_done never arrived', () => {
    expect(reduceAll([{ type: 'synthesis_token', delta: 'Plan' }, { type: 'done' }]).plan.status).toBe('done')
    expect(reduceAll([{ type: 'agent_report', report: report('tech') }, { type: 'done' }]).plan.status).toBe('failed')
  })

  it('fails when the stream ends without done, but not after done', () => {
    expect(reduceAll([{ type: 'agent_report', report: report('tech') }, { type: 'stream_error' }]).beat).toBe('failed')
    expect(reduceAll([{ type: 'done' }, { type: 'stream_error' }]).beat).toBe('done')
  })
})

// ── pacer + controller ───────────────────────────────────────────────────────
describe('pacing', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('spaces council reports 600ms apart even when they arrive together', () => {
    const released: string[] = []
    const pacer = createPacer({ gapMs: LIVE_GAPS, onRelease: (b) => b.forEach((e) => released.push(e.type === 'agent_report' ? e.report.key : e.type)) })
    ;['finance', 'market', 'tech'].forEach((k) => pacer.push({ type: 'agent_report', report: report(k) }))
    vi.advanceTimersByTime(0)
    expect(released).toEqual(['finance'])
    vi.advanceTimersByTime(599)
    expect(released).toEqual(['finance'])
    vi.advanceTimersByTime(1)
    expect(released).toEqual(['finance', 'market'])
    vi.advanceTimersByTime(600)
    expect(released).toEqual(['finance', 'market', 'tech'])
  })

  it('merges queued live plan tokens into one release, but not replay tokens', () => {
    const live: EpisodeEvent[][] = []
    const livePacer = createPacer({ gapMs: LIVE_GAPS, onRelease: (b) => live.push(b) })
    livePacer.push({ type: 'agent_report', report: report('tech') })
    ;['a', 'b', 'c'].forEach((d) => livePacer.push({ type: 'synthesis_token', delta: d }))
    vi.advanceTimersByTime(900)
    expect(live[1]).toEqual([{ type: 'synthesis_token', delta: 'abc' }])

    const replay: EpisodeEvent[][] = []
    const replayPacer = createPacer({ gapMs: REPLAY_GAPS, onRelease: (b) => replay.push(b) })
    ;['a', 'b'].forEach((d) => replayPacer.push({ type: 'synthesis_token', delta: d }))
    vi.advanceTimersByTime(0)
    expect(replay).toHaveLength(1)
    vi.advanceTimersByTime(30)
    expect(replay).toHaveLength(2)
  })

  it('skip releases everything at once and stops pacing', () => {
    const states: EpisodeState[] = []
    const c = createEpisodeController({ mode: 'live', onChange: (s) => states.push(s) })
    ;['finance', 'market', 'competition', 'tech', 'risk'].forEach((k) => c.push({ type: 'agent_report', report: report(k) }))
    vi.advanceTimersByTime(0)
    expect(c.state.seats.filter((s) => s.status === 'done')).toHaveLength(1)
    c.skip()
    expect(c.state.skipped).toBe(true)
    expect(c.state.seats.every((s) => s.status === 'done')).toBe(true)
    c.push({ type: 'done' })
    expect(c.state.beat).toBe('done') // no 600ms gap after skipping
  })

  it('dispose stops further releases', () => {
    const c = createEpisodeController({ mode: 'live', onChange: () => {} })
    c.push({ type: 'agent_report', report: report('finance') })
    c.push({ type: 'agent_report', report: report('market') })
    vi.advanceTimersByTime(0)
    c.dispose()
    vi.advanceTimersByTime(5000)
    expect(c.state.seats.filter((s) => s.status === 'done')).toHaveLength(1)
  })
})

// ── replay ───────────────────────────────────────────────────────────────────
describe('replay', () => {
  it('reproduces the live run’s final council, plan and glitch (spec invariant)', () => {
    // A "live" run: reports in their real arrival order, plan in small tokens, devil last
    const devil = session.agent_reports.find((r) => r.key === 'devils_advocate')!
    const live: EpisodeEvent[] = [
      { type: 'web_research', queries: ['q'] },
      ...session.agent_reports.filter((r) => r !== devil).map((r): EpisodeEvent => ({ type: 'agent_report', report: r })),
      ...(session.masterplan.match(/[\s\S]{1,7}/g) ?? []).map((d): EpisodeEvent => ({ type: 'synthesis_token', delta: d })),
      { type: 'synthesis_done', text: session.masterplan },
      { type: 'agent_report', report: devil },
      { type: 'done' },
    ]
    const fromLive = reduceAll(live)
    const fromReplay = stateFromSession(session)
    const core = (s: EpisodeState) => ({ seats: s.seats, extras: s.extras, plan: s.plan, glitch: s.glitch })
    expect(core(fromReplay)).toEqual(core(fromLive))
    expect(fromReplay.seats.every((s) => s.status === 'done')).toBe(true)
  })

  it('replays the plan in about 400 chunks and knows when replay is possible', () => {
    const tokens = replayEvents(session).filter((e) => e.type === 'synthesis_token')
    // ceil-sized chunks: 10,874 chars → 389 × 28 chars ≈ 11.7s at 30ms
    expect(tokens.length).toBeGreaterThanOrEqual(350)
    expect(tokens.length).toBeLessThanOrEqual(400)
    expect(canReplay(session)).toBe(true)
    expect(canReplay({ masterplan: 'x', agent_reports: [] })).toBe(false)
    expect(canReplay({ masterplan: '', agent_reports: session.agent_reports })).toBe(false)
  })

  it('builds results from a session or a live episode', () => {
    const fromSession = resultsFromSession(session)
    expect(fromSession).toMatchObject({ hasCouncil: true, live: false, planStatus: 'done' })
    expect(resultsFromSession({ masterplan: 'x', agent_reports: [] }).hasCouncil).toBe(false)
    expect(resultsFromEpisode(initialEpisode()).live).toBe(true)
  })
})
