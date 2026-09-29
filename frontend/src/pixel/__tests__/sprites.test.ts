import { describe, expect, it } from 'vitest'
import { HALVES, PALETTE, SPRITE_NAMES, buildSprite, mirror, mix, scale2x, shade } from '../sprites'

const SQUARE = /M(\d+) (\d+)h1v1h-1z/g

describe('source data', () => {
  it.each(SPRITE_NAMES)('%s is 16 rows of 8 known colour codes', (name) => {
    const rows = HALVES[name]
    expect(rows).toHaveLength(16)
    for (const row of rows) {
      expect(row).toHaveLength(8)
      for (const ch of row) expect(ch === '.' || ch in PALETTE).toBe(true)
    }
  })
})

describe('mirror', () => {
  it('reflects each left half into a symmetric row', () => {
    expect(mirror(['.kab'])).toEqual(['.kabbak.'])
  })
})

describe('scale2x', () => {
  it('doubles an isolated pixel into a 2×2 block', () => {
    expect(scale2x(['x'])).toEqual(['xx', 'xx'])
  })

  it('rounds an outer corner and fills an inner one (hand-computed EPX)', () => {
    expect(scale2x(['kk', 'k.'])).toEqual(['.kkk', 'kkkk', 'kkk.', 'kk..'])
  })
})

describe('mix', () => {
  it('blends toward white and toward the shadow ink', () => {
    expect(mix('#000000', 'light', 1)).toBe('#ffffff')
    expect(mix('#ffffff', 'dark', 1)).toBe('#141028')
    expect(mix('#808080', 'light', 0)).toBe('#808080')
  })
})

describe('shade', () => {
  it('leaves empty pixels empty and outlines unshaded', () => {
    const colours = shade(['.k', 'kk'])
    expect(colours[0][0]).toBeNull()
    expect(colours[0][1]).toBe(PALETTE.k)
  })

  it('shadows a body pixel whose lower/right neighbour is an edge', () => {
    expect(shade(['t'])[0][0]).toBe(mix(PALETTE.t, 'dark', 0.22))
  })
})

describe('buildSprite', () => {
  it.each(SPRITE_NAMES)('%s covers exactly the non-empty pixels of its 32×32 grid', (name) => {
    const grid = scale2x(mirror(HALVES[name]))
    expect(grid).toHaveLength(32)
    const expected = grid.join('').replace(/\./g, '').length

    const seen = new Set<string>()
    for (const { d } of buildSprite(name)) {
      for (const [, x, y] of d.matchAll(SQUARE)) {
        expect(Number(x)).toBeLessThan(32)
        expect(Number(y)).toBeLessThan(32)
        const key = `${x},${y}`
        expect(seen.has(key)).toBe(false) // no pixel is painted twice
        seen.add(key)
      }
    }
    expect(seen.size).toBe(expected)
  })

  it('uses one layer per distinct colour and caches the result', () => {
    const layers = buildSprite('coinbit')
    expect(new Set(layers.map((l) => l.fill)).size).toBe(layers.length)
    expect(buildSprite('coinbit')).toBe(layers)
  })
})
