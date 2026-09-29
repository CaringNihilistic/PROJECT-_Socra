/**
 * Socra cast sprites.
 *
 * Each sprite is authored as 16 rows × 8 chars (the left half), mirrored to 16×16,
 * upscaled to 32×32 with Scale2x (EPX) and then rim-lit. Source of truth:
 * docs/superpowers/specs/2026-09-30-socra-pixel-foundation-design.md, Appendix A.
 */

export const PALETTE: Record<string, string> = {
  k: '#1b1a2e', w: '#f4ecd8', W: '#ffffff', y: '#ffd23f', Y: '#c9941a',
  o: '#ff8c42', O: '#c4561f', r: '#e8474c', R: '#9e2a36', p: '#f28cb8',
  P: '#c0507f', v: '#9b7be0', V: '#5b3fa8', b: '#5b9cf0', B: '#2f5fb0',
  t: '#3ec7b5', T: '#1f8577', g: '#6fcf5f', G: '#3a8c35', s: '#b8c3d1',
  S: '#7a8699', d: '#4f5a6b', n: '#a86a3f', N: '#6e4225', h: '#e0b07a',
  f: '#ffd6ae', F: '#e0a878', x: '#3b3f5c', c: '#8ef0ff', e: '#4b3a8c',
  l: '#d9ccff',
}

export const HALVES = {
  coinbit: ['........', '....kkkk', '..kkSSyy', '.kSyYYyS', '.kSyyySS', 'kSSSSSsS', 'kSyYySyY', 'kSyyySyy', 'kSSSSSSS', 'ksssssss', 'kssWksss', 'ksskksss', 'kspssssN', '.kssssss', '..kddkkk', '........'],
  augurin: ['........', '.k......', '.kk.kkkk', '.kVkvvvk', '.kvvvvkc', 'kvwwwwvv', 'kvwkkwvv', 'kvwkkwvv', 'kvvwwvvo', 'kvvvvvvO', 'kVvlllll', 'kVvlllll', 'kVvvllll', '.kVvvvvv', '..kkookk', '........'],
  rivalix: ['........', '.k......', '.kk.....', '.kOk....', '.koOk.kk', '.kooOkoo', 'kooooooo', 'kokWoooo', 'kowwoooo', 'koowwwwk', '.kowwwww', 'kRRkoooo', 'kRRRkwww', 'kRRRkwww', '.kkkoooo', '...kkkkk'],
  beavolt: ['........', '...kkkkk', '..kyyyyy', '.kyyyyyY', 'kYYYYYYY', '.knnnnnn', '.knkWnnn', '.knkknnn', '.knnhhhN', '.kynhhhh', '..knnhhw', '..knnnkw', '.knnnnnn', '.knhhhhh', '..kNNkkk', '........'],
  omenyx: ['........', '.k......', '.kk.....', '.kVk..kk', '.kVVkkee', 'keVeeeee', 'keecceee', 'keeckeee', 'keeeeeee', 'keeeeeek', 'keeeeeew', 'keeeeeee', '.keeeeee', '.keVeVee', '..kek.ke', '...k...k'],
  socra: ['........', '....kkkk', '...kffff', '..ksffff', '..ksffff', '..ksffff', '..ksfkWf', '..ksfkkf', '..ksssss', '...kssss', '..kkksss', '.kWWWkss', 'kWWWWkbb', 'kWWsWkbb', '.kkxxkkk', '..kkkk..'],
  kai: ['...k.k..', '..kxkxkk', '.kxxxxxx', '.kxxxxxx', '.krrrrrr', '.kxfffff', '.kfkWfff', '.kfkkfff', '.kffffff', '..kffffk', '...kkkkk', '.kookwww', 'koookwww', 'kfooowww', '..kBBkkk', '..kkkk..'],
  dex: ['........', '...kkkkk', '..knnnnn', '.knnnnnn', '.knNnnnn', '.knfffff', '.kfkWkkk', '.kffffff', '.kffffff', '..kffffk', '...kkkkk', '.kttttwt', 'ktttttwt', 'kfttttTT', '..kxxkkk', '..kkkk..'],
  marin: ['........', '...kkkkk', '..kbbbbb', '.kbbbbbb', '.kbyyyyy', '.kbbffff', '.kbfkWff', '.kbfkkff', '.kbfffff', '..kbfffk', '...kkkkk', '.kbbbbww', 'kfbbbbbw', 'kfBBBBBB', '..kffkkk', '..kkkk..'],
  hex: ['........', '...kkkkk', '..ksssss', '.kssssss', '.ksSSsss', '.ksfffff', '.kVVVVVV', '.kVVVccV', '.kffffff', '..kffffk', '...kkkkk', '.kxxxxxr', 'kxxxxxrr', 'kfxxxxxx', '..kxxkkk', '..kkkk..'],
  rook: ['....kkkk', '...kxxRR', '..kxxxxR', '.kxxxxxx', '.kxxxxxx', '.kxfffff', '.kxfkkff', '.kffffff', '.kffffff', '..kfffkk', '...kkkkk', '.keeeeRe', 'keeeeeee', 'kfeeeeee', '..keekkk', '..kkkk..'],
  gremlix: ['........', '........', 'k.......', 'kgk..kkk', 'kgGkkggg', '.kgGgggg', '..kgyyyg', '..kgykkg', '..kggggg', '..kgkkkk', '..kgkwkw', '...kgggg', '...kgGgg', '...kgggg', '..kgGkkg', '..kkk.kk'],
  egg: ['........', '........', '......kk', '.....kww', '....kwww', '...kwwtt', '...kwwtt', '..kwwwww', '..kwtwww', '..kwttww', '..kwwwww', '..kwwwww', '...kwwww', '....kwww', '....kkkk', '........'],
  hatchling: ['........', '........', '........', '........', '....kkkk', '...kwwww', '..kwkwkw', '..kttttt', '.ktkWttt', '.ktkkttt', '.kpttttt', '.ktttttk', '..kttttt', '...kkkkk', '........', '........'],
  evolved: ['......ko', '.....kyo', '.....koO', '....kttt', '...ktttt', '..kttttt', '..ktkWtt', '..ktkktt', '..kttttt', '..kttttk', '.ktkkttt', '.kttkttw', '.kttktww', '..kkktww', '...kTTkk', '...kkk..'],
  final: ['k......y', 'kyk..kyy', '.kyk.kyt', '..kykttt', '..kttttt', '.kttkWtt', '.kttkktt', '.kyttttt', 'kttttttw', 'ktyytttw', 'ktyyttww', 'kttttwww', '.kttttww', '..kTTkkk', '..kkkk..', '........'],
} as const

export type SpriteName = keyof typeof HALVES

export const SPRITE_NAMES = Object.keys(HALVES) as SpriteName[]

/** One colour of a sprite: an SVG path of 1×1 squares in a 32×32 viewBox. */
export interface SpriteLayer {
  fill: string
  d: string
}

const EMPTY = '.'
const OUTLINE = 'k'
// Outline, specular highlights and glowing eyes stay flat; everything else is rim-lit
const NO_SHADE = new Set(['k', 'W', 'c'])

/** Left halves → full symmetric rows. */
export function mirror(halves: readonly string[]): string[] {
  return halves.map((half) => half + [...half].reverse().join(''))
}

/** Scale2x / EPX: doubles resolution, rounding diagonal edges while keeping hard pixels. */
export function scale2x(grid: readonly string[]): string[] {
  const h = grid.length
  const w = grid[0].length
  const at = (y: number, x: number) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : EMPTY)
  const out = Array.from({ length: h * 2 }, () => new Array<string>(w * 2).fill(EMPTY))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(y, x), A = at(y - 1, x), B = at(y, x + 1), C = at(y, x - 1), D = at(y + 1, x)
      out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P
      out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P
      out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P
      out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P
    }
  }
  return out.map((row) => row.join(''))
}

/** Blend a #rrggbb colour toward white (light) or the shadow ink (dark). */
export function mix(hex: string, toward: 'light' | 'dark', amount: number): string {
  const target = toward === 'light' ? [255, 255, 255] : [20, 16, 40]
  return '#' + target
    .map((t, i) => {
      const a = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
      return Math.round(a + (t - a) * amount).toString(16).padStart(2, '0')
    })
    .join('')
}

/**
 * Colour each pixel, adding a 1px shadow where the pixel below/right is outline or
 * empty, else a 1px highlight where the pixel above/left is. Returns null for empty.
 */
export function shade(grid: readonly string[]): (string | null)[][] {
  const n = grid.length
  const isEdge = (y: number, x: number) =>
    y < 0 || y >= n || x < 0 || x >= n || grid[y][x] === EMPTY || grid[y][x] === OUTLINE
  return grid.map((row, y) =>
    [...row].map((ch, x) => {
      if (ch === EMPTY) return null
      const base = PALETTE[ch]
      if (NO_SHADE.has(ch)) return base
      if (isEdge(y + 1, x) || isEdge(y, x + 1)) return mix(base, 'dark', 0.22)
      if (isEdge(y - 1, x) || isEdge(y, x - 1)) return mix(base, 'light', 0.28)
      return base
    }),
  )
}

const cache = new Map<SpriteName, SpriteLayer[]>()

/** Build (once) the SVG layers for a 32×32 sprite. */
export function buildSprite(name: SpriteName): SpriteLayer[] {
  const cached = cache.get(name)
  if (cached) return cached
  const colours = shade(scale2x(mirror(HALVES[name])))
  const byFill = new Map<string, string[]>()
  colours.forEach((row, y) =>
    row.forEach((fill, x) => {
      if (!fill) return
      const squares = byFill.get(fill) ?? []
      squares.push(`M${x} ${y}h1v1h-1z`)
      byFill.set(fill, squares)
    }),
  )
  const layers = [...byFill].map(([fill, squares]) => ({ fill, d: squares.join('') }))
  cache.set(name, layers)
  return layers
}
