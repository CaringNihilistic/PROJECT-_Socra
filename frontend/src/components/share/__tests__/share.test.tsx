import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import invoice from '../../../share/__fixtures__/publicSession.json'
import apiDocs from '../../../episode/__fixtures__/sampleSession.json'
import { COUNCIL } from '../../../pixel/cast'
import type { SessionData } from '../../../store/sessionStore'
import { TradingCard } from '../TradingCard'
import { NotFound } from '../ShareChrome'
import { CardView } from '../../CardPage'
import { SharedResults } from '../../SharePage'
import { VsScreen } from '../../ComparePage'

const full = invoice as unknown as SessionData
// The API-docs fixture has reports and a plan but no scores: fill in a low-scoring session
const other = { ...(apiDocs as object), scores: { problem_clarity: 0.5, scale_constraints: 0.3 }, explanations: [] } as unknown as SessionData
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

describe('TradingCard', () => {
  it('shows HP, the five stats, the grade, the flavour and the card number', () => {
    const html = renderToStaticMarkup(<TradingCard session={full} />)
    expect(html).toContain('HP 87')
    for (const label of ['CLARITY', 'SCALE', 'TECH', 'GOAL', 'RISK']) expect(html).toContain(label)
    expect(html).toContain('FINAL FORM · GREENLIT')
    expect(html).toContain('pixel-holo')
    expect(html).toContain('The council agrees on one thing')
    expect(html).toContain(`#${full.id.slice(0, 6).toUpperCase()}`)
  })

  it('without a plan: the stage from the phase and a placeholder line', () => {
    const html = renderToStaticMarkup(<TradingCard session={{ ...full, masterplan: null, phase: 'debate', total_score: 0.42 }} />)
    expect(html).toContain('HATCHLING · DEVELOPING')
    expect(html).toContain('Still under interrogation.')
    expect(html).not.toContain('pixel-holo')
  })

  it('the card page offers the PNG and the link', () => {
    const html = renderToStaticMarkup(<CardView session={full} />)
    expect(html).toContain('DOWNLOAD PNG')
    expect(html).toContain('COPY LINK')
    expect(html).toContain('RUN YOUR IDEA')
  })
})

describe('SharedResults', () => {
  it('renders the results with WATCH EPISODE and a call to action, without a re-run', () => {
    const html = renderToStaticMarkup(<SharedResults session={full} />)
    expect(html).toContain('WATCH EPISODE')
    expect(html).toContain('TEAM GLITCH')
    expect(html).toContain('PRESS START')
    expect(html).not.toContain('RE-RUN')
  })

  it('not found says so, with a way in', () => {
    const html = renderToStaticMarkup(<NotFound message="This masterplan doesn’t exist, or isn’t finished yet." />)
    expect(html).toContain('doesn’t exist')
    expect(html).toContain('href="/"')
  })
})

describe('VsScreen', () => {
  it('pits both ideas against each other, stat by stat and seat by seat', () => {
    const html = renderToStaticMarkup(<VsScreen a={full} b={other} ids={['aaa', 'bbb']} />)
    expect(html).toContain('>VS<')
    expect(html).toContain(esc(full.initial_idea.slice(0, 30)))
    expect(html).toContain('STATS')
    for (const c of Object.values(COUNCIL)) expect(html).toContain(c.name.toUpperCase())
    expect(html).toContain('READ PLAN A')
    expect(html).toContain('href="/share/bbb"')
    expect(html).toContain('scale-x-[-1]')
  })

  it('a side that failed to load says so, and the stats are skipped', () => {
    const html = renderToStaticMarkup(<VsScreen a={full} b={null} ids={['aaa', 'bbb']} />)
    expect(html).toContain('Idea B couldn’t be loaded.')
    expect(html).not.toContain('>STATS<')
    expect(html).toContain('No report')
  })
})
