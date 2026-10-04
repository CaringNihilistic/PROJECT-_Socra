import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { COUNCIL, PROFESSOR, TEAM_GLITCH, TRAINERS } from '../../../pixel/cast'
import { JOURNEY, SCENE_START, journeyFrame } from '../../../landing/journey'
import type { SessionSummary } from '../../../store/sessionStore'
import { EXAMPLES, TitleScreen } from '../TitleScreen'
import { ContinueMenu } from '../ContinueMenu'
import { JourneyDemo, JourneyStage } from '../JourneyDemo'
import { CastRoster } from '../CastRoster'
import { FinalCta, GetUpdates } from '../ManualSections'
import { GlitchBand } from '../GlitchBand'
import { HowItPlays } from '../HowItPlays'
import { TitleScene } from '../TitleScene'

const noop = () => {}
const html = (node: JSX.Element) => renderToStaticMarkup(node)
// renderToStaticMarkup escapes apostrophes and quotes
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

describe('TitleScreen', () => {
  const render = (props: Partial<Parameters<typeof TitleScreen>[0]> = {}) =>
    html(<TitleScreen idea="" onIdeaChange={noop} onStart={noop} onExample={noop} loading={false} error={null} {...props} />)

  it('has the headline, one labelled idea box and one bright primary button', () => {
    const out = render()
    expect(out).toContain('bad ideas')
    expect(out).toContain('ChatGPT tells you how to build it. Socra tells you if you should.')
    expect(out).toMatch(/<label for="idea-box"[^>]*>WHAT’S YOUR IDEA\?<\/label>/)
    expect(out.match(/<textarea/g)).toHaveLength(1)
    expect(out.replace(/<[^>]+>/g, '')).toContain('START INTERROGATION→')
    // the only primary button, and never greyed out for being empty
    expect(out.match(/pixel-btn-primary/g)).toHaveLength(1)
    expect(out).not.toMatch(/<button[^>]*disabled/)
  })

  it('Prof. Socra stands beside the box with his line', () => {
    expect(render()).toContain('No masterplan until I understand you. Tell me your idea.')
  })

  it('keeps the three exact STUB_MODE example ideas', () => {
    const out = render()
    expect(EXAMPLES).toEqual([
      'A SaaS platform where developers can collaboratively review and annotate API documentation',
      'A marketplace for freelance ML engineers to bid on short-term data labeling contracts',
      'A mobile app that tracks grocery prices across local stores using receipt scanning',
    ])
    // the chips are cut short by CSS only: the full string is each button's text
    for (const ex of EXAMPLES) expect(out).toContain(`>${ex}</button>`)
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
  const stage = (t: number) => html(<JourneyStage frame={journeyFrame(t)} />)

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
    for (const label of ['WHAT HAPPENS NEXT', 'PAUSE', 'REPLAY', 'TEST YOUR IDEA']) expect(out).toContain(label)
    // the step rail: four stages in order, the first one current
    expect(out.replace(/<[^>]+>/g, ' ')).toMatch(/1\s+ASK.*2\s+EVOLVE.*3\s+COUNCIL.*4\s+PLAN/)
    expect(out.match(/aria-current="step"/g)).toHaveLength(1)
  })
})

describe('TitleScene', () => {
  it('frames the title screen with scenery, all decorative', () => {
    const out = html(<TitleScene><p>the idea box</p></TitleScene>)
    expect(out).toContain('the idea box')
    // the scenery is hidden from screen readers; the content is not
    expect(out).toContain('pixel-drift')
    expect(out).not.toMatch(/aria-hidden="true"[^>]*><p>the idea box/)
  })
})

describe('manual sections', () => {
  it('the cast comes from cast.ts', () => {
    const out = html(<CastRoster />)
    expect(out).toContain('MEET THE COUNCIL')
    for (const c of [PROFESSOR, ...Object.values(COUNCIL)]) expect(out).toContain(c.name.toUpperCase())
    // the type pills are explained in words, not by colour alone
    for (const what of ['the money', 'the market', 'your rivals', 'the build', 'the risk']) expect(out).toContain(`attacks ${what}`)
    // the trainers appear with the plan, not on the landing page's roster
    for (const t of Object.values(TRAINERS)) expect(out).not.toContain(`>${t.name.toUpperCase()}<`)
  })

  it('Team Glitch has its own band', () => {
    const out = html(<GlitchBand />)
    expect(out).toContain('TEAM GLITCH')
    expect(out).toContain('Not every idea survives.')
    expect(out).toContain(esc(TEAM_GLITCH.motto))
    for (const m of TEAM_GLITCH.members) expect(out).toContain(m.name.toUpperCase())
  })

  it('how it plays has the three steps', () => {
    const out = html(<HowItPlays />)
    for (const s of ['INTERROGATION', 'THE COUNCIL', 'THE MASTERPLAN']) expect(out).toContain(s)
  })

  it('updates are honest: no early-access promise', () => {
    const out = html(<GetUpdates apiUrl="http://x" />)
    // the final call to action sends people back to the hero's box: it has no input of its own
    const cta = html(<FinalCta onStart={noop} />)
    expect(cta).toContain('READY TO RISK YOUR IDEA?')
    expect(cta).not.toMatch(/<input|<textarea/)
    expect(out).toContain('GET UPDATES')
    expect(out.toLowerCase()).not.toContain('early access')
  })
})
