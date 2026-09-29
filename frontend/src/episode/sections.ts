/** Split the masterplan into presentable sections, each owned by a trainer. */
import { TRAINERS, trainerForHeading, type Character } from '../pixel/cast'
import { plainText } from './signature'

export interface PlanSection {
  /** Cleaned heading, or null for text before the first section (the intro). */
  heading: string | null
  /** Markdown body, including any deeper sub-headings. */
  body: string
  trainer: Character
}

const MD_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const BOLD_HEADING = /^\*\*([^*]{3,80})\*\*:?\s*$/
// Words from the synthesis prompt's section list (llm_client._build_synthesis_prompt)
const SECTION_WORDS = /verdict|tech stack|phase|mvp|growth|moat|risk|files/i

/** Remove bold markers and leading numbering ("1. ", "Phase 1:" stays). */
export function cleanHeading(raw: string): string {
  return raw.replace(/\*\*/g, '').replace(/^\d+[.)]\s+/, '').trim()
}

interface HeadingLine {
  index: number
  level: number
  text: string
}

function findHeadings(lines: string[]): HeadingLine[] {
  const md = lines.flatMap((line, index) => {
    const m = line.match(MD_HEADING)
    return m ? [{ index, level: m[1].length, text: m[2] }] : []
  })
  if (md.length) return md
  // Only when the plan has no markdown headings at all: treat whole-line bold as headings
  return lines.flatMap((line, index) => {
    const m = line.trim().match(BOLD_HEADING)
    return m ? [{ index, level: 1, text: m[1] }] : []
  })
}

/**
 * Which heading level holds the plan's sections. Real plans differ: some use
 * "# TECH STACK" with "## What to Build" inside, others wrap everything in "# THE PLAY"
 * with "## Tech Stack" beneath. Pick the level whose headings best match the section
 * vocabulary (ties → shallowest); with no matches, the shallowest level used twice.
 */
function sectionLevel(headings: HeadingLine[]): number | undefined {
  const levels = [...new Set(headings.map((h) => h.level))].sort((a, b) => a - b)
  const score = (level: number) => headings.filter((h) => h.level === level && SECTION_WORDS.test(h.text)).length
  const best = levels.reduce<number | undefined>((acc, l) => (acc === undefined || score(l) > score(acc) ? l : acc), undefined)
  if (best !== undefined && score(best) > 0) return best
  return levels.find((l) => headings.filter((h) => h.level === l).length >= 2) ?? levels[0]
}

/**
 * Split on the section level and every shallower level (so "# CHAIRMAN'S VERDICT"
 * above "## Tech Stack" is still its own section). Deeper headings stay inside their
 * section. Empty sections are dropped, except the last one while it is still streaming.
 */
export function parseSections(markdown: string): PlanSection[] {
  const lines = markdown.split('\n')
  const headings = findHeadings(lines)
  const level = sectionLevel(headings)
  const splits = level === undefined ? [] : headings.filter((h) => h.level <= level)

  const sections: PlanSection[] = []
  const intro = lines.slice(0, splits[0]?.index ?? lines.length).join('\n').trim()
  if (intro) sections.push({ heading: null, body: intro, trainer: TRAINERS.kai })

  splits.forEach((h, i) => {
    const heading = cleanHeading(h.text)
    const body = lines.slice(h.index + 1, splits[i + 1]?.index ?? lines.length).join('\n').trim()
    const last = i === splits.length - 1
    if (body || last) sections.push({ heading, body, trainer: trainerForHeading(heading) })
  })
  return sections
}

/** The last ~`max` characters of a section as plain text, for the trainer relay dialog. */
export function sectionTail(body: string, max = 320): string {
  const text = plainText(body.replace(/^#{1,6}\s+/gm, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, ''))
  if (text.length <= max) return text
  // Start the tail on a word boundary
  return '…' + text.slice(text.length - max).replace(/^\S*\s/, '')
}
