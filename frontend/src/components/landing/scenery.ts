/*
 * Pixel scenery tiles for the landing page: stars, clouds, hills, grass and soil.
 * Each is a small SVG used as a repeating CSS background, so the pixels stay square
 * at any screen width. Positions come from a fixed-seed generator: same scene every load.
 */

export const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${body}</svg>`,
  )}")`

const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'/>`

/** A fixed-seed LCG: the same "random" scatter on every load. */
function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}

function scatter(seed: number, count: number, size: number, colours: string[], w: number, h: number) {
  const rand = seeded(seed)
  let body = ''
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * (w - size))
    const y = Math.floor(rand() * (h - size))
    body += rect(x, y, size, size, colours[Math.floor(rand() * colours.length)])
  }
  return svg(w, h, body)
}

// ── Sky ──────────────────────────────────────────────────────────────────────

/** Dim pinpricks, plus a few brighter stars on their own layer so only those twinkle. */
export const DIM_STARS = scatter(7, 18, 2, ['#8f88b8', '#5b5490', '#b9b3d6'], 240, 240)
export const BRIGHT_STARS = scatter(42, 5, 3, ['#f4ecd8', '#ffd23f'], 240, 240)

type Span = [number, number] // [start, end) of a run of pixels in one row

/**
 * A cloud from per-row spans, shaded like pixel art: a pixel with open sky above it is lit,
 * one with open sky below it is in shade, the rest is the body.
 */
function cloud(x0: number, y0: number, rows: Span[][], [lit, body, shade]: [string, string, string]) {
  const filled = (x: number, y: number) => rows[y]?.some(([a, b]) => x >= a && x < b) ?? false
  let out = ''
  rows.forEach((spans, y) =>
    spans.forEach(([a, b]) => {
      // merge consecutive same-colour pixels into one rect
      let runStart = a
      let runColour = ''
      for (let x = a; x <= b; x++) {
        const colour = x === b ? '' : !filled(x, y - 1) ? lit : !filled(x, y + 1) ? shade : body
        if (colour !== runColour) {
          if (runColour) out += rect(x0 + runStart, y0 + y, x - runStart, 1, runColour)
          runStart = x
          runColour = colour
        }
      }
    }),
  )
  return out
}

// A cumulus with three stacked bumps, a round puff, and a low wisp: tall enough to read as
// clouds rather than flat saucers
const BILLOW: Span[][] = [
  [[16, 24]], [[13, 27]], [[12, 28]], [[6, 10], [11, 29]], [[4, 30], [32, 38]], [[3, 40]],
  [[2, 42]], [[1, 43]], [[0, 44]], [[0, 44]], [[1, 43]], [[4, 40]],
]
const PUFF: Span[][] = [[[9, 17]], [[7, 20]], [[5, 22]], [[3, 24]], [[2, 26]], [[1, 27]], [[0, 28]], [[0, 28]], [[2, 26]]]
const WISP: Span[][] = [[[8, 14], [20, 24]], [[5, 17], [18, 27]], [[2, 31]], [[0, 34]], [[0, 34]], [[3, 30]]]

// Lighter than the horizon glow behind them (#2a2652), or only the lit edge shows
const NEAR: [string, string, string] = ['#7a73b8', '#565090', '#3d3872']
const FAR: [string, string, string] = ['#57518f', '#433e78', '#363166']

/**
 * Two cloud bands for parallax: varied clouds in front, dimmer ones behind. Wide tiles with
 * irregular spacing, so the repeat is hard to spot.
 */
export const NEAR_CLOUDS = svg(320, 16, cloud(12, 2, BILLOW, NEAR) + cloud(140, 9, WISP, NEAR) + cloud(232, 5, PUFF, NEAR))
export const FAR_CLOUDS = svg(280, 12, cloud(40, 1, PUFF, FAR) + cloud(178, 5, WISP, FAR))

// ── Land ─────────────────────────────────────────────────────────────────────

/** Stepped hill silhouettes, one 96px tile each (drawn on a 4px grid). */
const stepped = (fill: string, steps: number[]) =>
  svg(96, 24, steps.map((top, i) => rect(i * 4, top, 4, 24 - top, fill)).join(''))
export const FAR_HILLS = stepped('#221f3f', [14, 12, 10, 8, 8, 6, 6, 6, 8, 8, 10, 12, 12, 14, 14, 12, 10, 10, 8, 8, 10, 12, 14, 14])
export const NEAR_HILLS = stepped('#16142b', [18, 18, 16, 14, 14, 12, 12, 14, 16, 18, 18, 20, 20, 18, 16, 16, 14, 14, 16, 18, 20, 20, 20, 18])

/** The grass edge at the bottom of the page: a ragged top, tufts, and the odd flower. */
const GRASS_TOPS = [3, 2, 3, 4, 3, 1, 2, 3, 4, 4, 3, 2, 3, 4, 3, 2, 1, 2, 3, 4, 3, 3, 2, 3, 4, 4, 3, 1, 2, 3, 4, 3]
export const GRASS = svg(
  64,
  12,
  GRASS_TOPS.map((top, i) => rect(i * 2, top, 2, 1, '#4f8a55') + rect(i * 2, top + 1, 2, 11 - top, '#2f5f3c')).join('') +
    // darker blades and two night flowers
    rect(10, 6, 1, 3, '#24492f') + rect(34, 7, 1, 2, '#24492f') + rect(52, 5, 1, 3, '#24492f') +
    rect(21, 2, 1, 1, '#ffd23f') + rect(45, 3, 1, 1, '#e0609f'),
)

/** Soil under the grass, with a scatter of stones. */
export const SOIL = (() => {
  const rand = seeded(3)
  let body = rect(0, 0, 64, 64, '#2a1f19')
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * 62)
    const y = Math.floor(rand() * 62)
    body += rect(x, y, 2, 1, rand() < 0.5 ? '#3a2b22' : '#211812')
  }
  return svg(64, 64, body)
})()
