/**
 * The /card trading card's data: grade and rarity frame, flavour text, card number.
 * docs/superpowers/specs/2026-09-30-socra-share-pages-design.md §2
 */
import { truncate } from '../episode/signature'

export interface Grade {
  label: 'GREENLIT' | 'STRONG' | 'DEVELOPING' | 'EARLY STAGE'
  /** Frame border class (literal, so Tailwind keeps it) */
  frame: string
  /** Text class for the grade label on a panel */
  text: string
  /** The gold holo sheen, only for GREENLIT */
  holo: boolean
}

const GRADES: { min: number; grade: Grade }[] = [
  { min: 80, grade: { label: 'GREENLIT', frame: 'border-px-xp', text: 'text-px-xp', holo: true } },
  { min: 60, grade: { label: 'STRONG', frame: 'border-px-plan', text: 'text-px-plan', holo: false } },
  { min: 40, grade: { label: 'DEVELOPING', frame: 'border-px-psy', text: 'text-px-psy', holo: false } },
  { min: 0, grade: { label: 'EARLY STAGE', frame: 'border-px-edge', text: 'text-px-muted', holo: false } },
]

/** Grade from a 0–100 score (the legacy VerdictCard's thresholds and labels). */
export function gradeFor(score: number): Grade {
  return GRADES.find((g) => score >= g.min)!.grade
}

export const FLAVOR_MAX = 140

/** The first sentence of the verdict's first paragraph, as plain text. */
export function flavorText(masterplan?: string | null): string | null {
  if (!masterplan) return null
  // The first run of prose lines. Headings, tables, lists and rules are skipped line by line:
  // template-style plans put the verdict directly under its heading, with no blank line between.
  const prose: string[] = []
  for (const raw of masterplan.split(/\r?\n/)) {
    const line = raw.trim()
    const isProse = line !== '' && !/^(#|\||>|[-*+]\s|\d+\.\s|-{3,}$)/.test(line)
    if (isProse) prose.push(line)
    else if (prose.length) break
  }
  if (!prose.length) return null
  const plain = prose
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = plain.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? plain
  return truncate(sentence, FLAVOR_MAX)
}

export function cardNumber(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`
}
