import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { COUNCIL, TEAM_GLITCH, TRAINERS } from '../../../pixel/cast'
import { JOURNEY, SCENE_START, journeyFrame } from '../../../landing/journey'
import type { SessionSummary } from '../../../store/sessionStore'
import { EXAMPLES, TitleScreen } from '../TitleScreen'
import { ContinueMenu } from '../ContinueMenu'
import { JourneyDemo, JourneyStage } from '../JourneyDemo'
import { CastRoster } from '../CastRoster'
import { FreeToPlay, GetUpdates, SaysNo } from '../ManualSections'
import { HowItPlays } from '../HowItPlays'

const noop = () => {}
const html = (node: JSX.Element) => renderToStaticMarkup(node)
// renderToStaticMarkup escapes apostrophes and quotes
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

describe('TitleScreen', () => {
  const render = (props: Partial<Parameters<typeof TitleScreen>[0]> = {}) =>
    html(<TitleScreen idea="" onIdeaChange={noop} onStart={noop} onExample={noop} loading={false} error={null} {...props} />)

  it('has the headline, NAME YOUR IDEA and PRESS START', () => {
    const out = render()
    expect(out).toContain('bad ideas')
    expect(out).toContain('NAME YOUR IDEA')
    expect(out).toContain('PRESS START')
  })

  it('keeps the three exact STUB_MODE example ideas', () => {
    const out = render()
    expect(EXAMPLES).toHaveLength(3)
    for (const ex of EXAMPLES) expect(out).toContain(ex)
  })

  it('shows loading and errors', () => {
    expect(render({ idea: 'x', loading: true })).toContain('LOADING…')
    expect(render({ error: 'Server unavailable' })).toContain('Server unavailable')
  })
})

describe('ContinueMenu', () => {
  const sessions: SessionSummary[] = [
    { id: 'a', initial_idea: 'Invoice chaser', phase: 'debate', total_score: 0.42, has_masterplan: false, created_at: null },
    { id: 'b', initial_idea: 'Grocery prices', phase: 'masterplan', total_score: 0.87, has_masterplan: true, created_at: null },
  ]
  const render = (compareId: string | null = null) =>
    html(<ContinueMenu sessions={sessions} compareId={compareId} loading={false} onResume={noop} onCompare={noop} />)

  it('lists saves with stage names, scores and a compare button only on plans', () => {
    const out = render()
    expect(out).toContain('HATCHLING')
    expect(out).toContain('42%')
    expect(out).toContain('FINAL FORM')
    expect(out).toContain('✓ PLAN')
    expect(out.match(/aria-pressed/g)).toHaveLength(1)
  })

  it('shows the compare banner while one plan is selected', () => {
    expect(render()).not.toContain('PICK ANOTHER')
    expect(render('b')).toContain('PICK ANOTHER')
  })

  it('renders nothing without saves', () => {
    expect(html(<ContinueMenu sessions={[]} compareId={null} loading={false} onResume={noop} onCompare={noop} />)).toBe('')
  })
})

describe('JourneyDemo', () => {
  const stage = (t: number) => html(<JourneyStage frame={journeyFrame(t)} onStart={noop} />)

  it('ask: the recorded question and choices', () => {
    const out = stage(0)
    // the recorded question's opening run of plain words (before any markdown or punctuation)
    const opening = JOURNEY.question.replace(/^[*_\s]+/, '').match(/^[A-Za-z0-9 ]+/)![0].trim()
    expect(opening.length).toBeGreaterThan(3)
    expect(out.replace(/<[^>]+>/g, '')).toContain(opening)
    for (const c of JOURNEY.choices) expect(out).toContain(esc(c))
  })

  it('evolve: the egg evolving, then the hatchling', () => {
    expect(stage(SCENE_START.evolve)).toContain('What? IDEA EGG is evolving!')
    expect(stage(8000)).toContain('evolved into HATCHLING!')
  })

  it('council, plan and end', () => {
    expect(stage(14000)).toContain('THE COUNCIL')
    expect(stage(19600).toLowerCase()).toContain('chairman')
    expect(stage(21000)).toContain('YOUR TURN.')
  })

  it('renders its controls', () => {
    const out = html(<JourneyDemo onStart={noop} />)
    for (const label of ['WATCH A RUN', 'PAUSE', 'REPLAY', '1 ASK', '4 PLAN']) expect(out).toContain(label)
  })
})

describe('manual sections', () => {
  it('the cast comes from cast.ts', () => {
    const out = html(<CastRoster />)
    for (const c of Object.values(COUNCIL)) expect(out).toContain(c.name.toUpperCase())
    for (const t of Object.values(TRAINERS)) expect(out).toContain(t.name.toUpperCase())
    expect(out).toContain(esc(TEAM_GLITCH.motto))
  })

  it('how it plays has the three steps', () => {
    const out = html(<HowItPlays />)
    for (const s of ['INTERROGATION', 'THE COUNCIL', 'THE MASTERPLAN']) expect(out).toContain(s)
  })

  it('updates are honest: no early-access promise', () => {
    const out = html(<GetUpdates apiUrl="http://x" />) + html(<FreeToPlay onStart={noop} />) + html(<SaysNo />)
    expect(out).toContain('GET UPDATES')
    expect(out.toLowerCase()).not.toContain('early access')
  })
})
