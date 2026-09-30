import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PixelPreview } from '../PixelPreview'
import { Sprite } from '../Sprite'
import { XpBar } from '../ui/XpBar'
import { COUNCIL, TEAM_GLITCH, TRAINERS } from '../cast'

describe('PixelPreview', () => {
  it('renders every character and kit component without throwing', () => {
    const html = renderToStaticMarkup(<PixelPreview />)
    const names = [
      ...Object.values(COUNCIL).map((c) => c.name),
      ...TEAM_GLITCH.members.map((m) => m.name),
      ...Object.values(TRAINERS).map((t) => t.name),
    ]
    for (const name of names) expect(html).toContain(name.toUpperCase())
    expect(html).toContain('FINAL FORM')
    expect(html).toContain('role="meter"')
    expect(html).toContain('pixel-btn-primary')
  })
})

describe('Sprite', () => {
  it('is decorative by default and named when labelled', () => {
    expect(renderToStaticMarkup(<Sprite name="coinbit" size={64} />)).toContain('aria-hidden="true"')
    const labelled = renderToStaticMarkup(<Sprite name="coinbit" size={64} label="Coinbit" />)
    expect(labelled).toContain('role="img"')
    expect(labelled).toContain('aria-label="Coinbit"')
    expect(labelled).not.toContain('aria-hidden')
  })

  it('renders crisp at the requested whole-number size', () => {
    const html = renderToStaticMarkup(<Sprite name="omenyx" size={96} />)
    expect(html).toContain('width="96"')
    expect(html).toContain('shape-rendering="crispEdges"')
  })
})

describe('XpBar', () => {
  it('shows XP toward the next threshold', () => {
    expect(renderToStaticMarkup(<XpBar score={0.64} />)).toContain('XP 64 / 70 · 6 to evolve')
    // just under a threshold never reads as full (seen live: 0.398 showed 40 / 40, 0 to evolve)
    expect(renderToStaticMarkup(<XpBar score={0.398} />)).toContain('XP 39 / 40 · 1 to evolve')
    expect(renderToStaticMarkup(<XpBar score={0.29} />)).toContain('XP 29 / 40')
  })

  it('is full at Final Form', () => {
    const html = renderToStaticMarkup(<XpBar score={0.85} />)
    expect(html).toContain('FINAL FORM')
    expect(html).toContain('width:100%')
  })
})
