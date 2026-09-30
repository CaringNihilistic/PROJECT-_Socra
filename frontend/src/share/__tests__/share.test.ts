import { describe, expect, it } from 'vitest'
import invoice from '../__fixtures__/publicSession.json'
import apiDocs from '../../episode/__fixtures__/sampleSession.json'
import { COUNCIL } from '../../pixel/cast'
import type { AgentReport } from '../../episode/events'
import { FLAVOR_MAX, cardNumber, flavorText, gradeFor } from '../card'
import { councilPairs, statPairs } from '../compare'

describe('gradeFor', () => {
  it('keeps the legacy thresholds', () => {
    expect([0, 39, 40, 59, 60, 79, 80, 100].map((s) => gradeFor(s).label)).toEqual([
      'EARLY STAGE', 'EARLY STAGE', 'DEVELOPING', 'DEVELOPING', 'STRONG', 'STRONG', 'GREENLIT', 'GREENLIT',
    ])
    expect(gradeFor(80).holo).toBe(true)
    expect(gradeFor(79).holo).toBe(false)
  })
})

describe('flavorText', () => {
  it('is the verdict’s first sentence, plain and short, on both recorded plans', () => {
    for (const plan of [invoice.masterplan, apiDocs.masterplan]) {
      const text = flavorText(plan)!
      expect(text.length).toBeLessThanOrEqual(FLAVOR_MAX)
      expect(text).not.toMatch(/[*#_`]/)
      expect(text.startsWith('The council agrees on one thing')).toBe(true)
    }
    // the short one ends as a sentence, the long one is cut on a word with an ellipsis
    expect(flavorText(apiDocs.masterplan)).toMatch(/build it\.$/)
    expect(flavorText(invoice.masterplan)).toMatch(/\S…$/)
  })

  it('is null without a plan or a paragraph', () => {
    expect(flavorText(null)).toBeNull()
    expect(flavorText('# Only a heading')).toBeNull()
  })
})

describe('cardNumber', () => {
  it('is the id prefix, upper-cased', () => {
    expect(cardNumber('362004de-377e')).toBe('#362004')
    expect(cardNumber('abcdef12')).toBe('#ABCDEF')
  })
})

describe('statPairs', () => {
  it('marks the leader per stat, with rounded ties', () => {
    const pairs = statPairs({ problem_clarity: 0.65, scale_constraints: 0.2, tech_context: 0.5 }, { problem_clarity: 0.4, scale_constraints: 0.55, tech_context: 0.504 })
    expect(pairs.map((p) => p.leader)).toEqual(['a', 'b', 'tie', 'tie', 'tie'])
    expect(pairs[0]).toMatchObject({ label: 'CLARITY', a: 65, b: 40 })
    expect(pairs[3]).toMatchObject({ a: 0, b: 0 })
  })
})

describe('councilPairs', () => {
  it('pairs every council seat, with null for missing and fainted reports', () => {
    const b: AgentReport[] = [
      { ...(apiDocs.agent_reports.find((r) => r.key === 'finance') as AgentReport) },
      { key: 'risk', title: 'The Skeptic', icon: '', content: '_Analysis unavailable — RateLimitError_' } as AgentReport,
    ]
    const pairs = councilPairs(invoice.agent_reports as AgentReport[], b)
    expect(pairs.map((p) => p.key)).toEqual(Object.keys(COUNCIL))
    expect(pairs.every((p) => p.a)).toBe(true)
    const byKey = Object.fromEntries(pairs.map((p) => [p.key, p]))
    expect(byKey.finance.b).toBeTruthy()
    expect(byKey.risk.b).toBeNull()
    expect(byKey.market.b).toBeNull()
  })
})
