import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import fixture from '../../../chat/__fixtures__/chatSession.json'
import { STAGES } from '../../../pixel/cast'
import { BattleScreen, type BattleSession } from '../BattleScreen'
import { EvolutionScene } from '../EvolutionScene'
import { ChatDemo } from '../ChatDemo'
import { WRITE_OWN } from '../AnswerMenu'

type Snapshot = BattleSession & { choices: string[] }
const intake = fixture.intake as unknown as Snapshot
const debate = fixture.debate as unknown as Snapshot
const noop = () => {}

const render = (session: Snapshot, overrides: Partial<Parameters<typeof BattleScreen>[0]> = {}) =>
  renderToStaticMarkup(
    <BattleScreen
      session={session}
      isSending={false}
      streaming=""
      choices={session.choices}
      pendingAnswer=""
      streamError={null}
      savedFlash={false}
      onSend={noop}
      onCycleAssumption={noop}
      {...overrides}
    />,
  )

// renderToStaticMarkup escapes quotes and apostrophes: compare on a safe slice
const safe = (text: string) => text.replace(/[*_#>`"'&<]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4).join(' ')

describe('BattleScreen', () => {
  it('turn 1: an Idea Egg with all five stats, Socra’s question and the answer menu', () => {
    const html = render(intake)
    expect(html).toContain('IDEA EGG')
    for (const label of ['CLARITY', 'SCALE', 'TECH', 'GOAL', 'RISK']) expect(html).toContain(label)
    expect(html).toContain('PROF. SOCRA')
    expect(html).toContain('Interesting idea')
    for (const choice of intake.choices) expect(html).toContain(safe(choice))
    expect(html).toContain(WRITE_OWN)
  })

  it('turn 3: a Hatchling, field notes, stat notes as buttons, and a log without the current question', () => {
    const html = render(debate)
    expect(html).toContain('HATCHLING')
    expect(html).toContain('FIELD NOTES')
    expect(html).toContain(`${debate.assumptions.length} assumptions`)
    expect(html).toContain('aria-controls="stat-note-problem_clarity"')
    expect(html).toContain('LOG (5)')
    expect(html).toContain('two soft spots') // the current question is in the dialog
  })

  it('hides the menu while sending and shows the answer being sent', () => {
    const html = render(intake, { isSending: true, pendingAnswer: 'Solo designers', streaming: 'Good. Now' })
    expect(html).not.toContain(WRITE_OWN)
    expect(html).toContain('Solo designers')
    expect(html).toContain('Good. Now')
    expect(html).toMatch(/<textarea[^>]*disabled/)
  })

  it('a dropped stream offers RETRY', () => {
    const html = render(debate, { streamError: 'network', onRetry: noop })
    expect(html).toContain('CONNECTION LOST')
    expect(html).toContain('RETRY')
  })

  it('switches the answer box to follow-ups once a masterplan exists', () => {
    const html = render({ ...debate, masterplan: '# Plan', choices: ['x'] })
    expect(html).toContain('FINAL FORM')
    expect(html).toContain('Ask a follow-up')
    expect(html).not.toContain(WRITE_OWN)
  })
})

describe('EvolutionScene', () => {
  const [egg, hatchling] = STAGES

  it('starts with the evolving line and a Skip', () => {
    const html = renderToStaticMarkup(<EvolutionScene evolution={{ from: egg, to: hatchling }} onClose={noop} reducedMotion={false} />)
    expect(html).toContain('What? IDEA EGG is evolving!')
    expect(html).toContain('SKIP')
    expect(html).toContain('pixel-evolve-old')
  })

  it('under reduced motion shows the result straight away', () => {
    const html = renderToStaticMarkup(<EvolutionScene evolution={{ from: egg, to: hatchling }} onClose={noop} reducedMotion />)
    expect(html).toContain('Your idea evolved into HATCHLING!')
    expect(html).toContain('The council can now debate it.')
    expect(html).toContain('CONTINUE')
    expect(html).not.toContain('pixel-evolve-old')
  })
})

describe('ChatDemo', () => {
  it('renders without the backend', () => {
    expect(renderToStaticMarkup(<ChatDemo />)).toContain('EVOLVE')
  })
})
