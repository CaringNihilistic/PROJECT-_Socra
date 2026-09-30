/** Extract a creature's one-line "signature" from its full markdown report. */

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/
const HEADING = /^\s*#{1,6}\s/
const BOLD_LABEL = /^\s*\*\*[^*]+\*\*:?\s*$/
// The backend's failure placeholders always start the report (e.g. "_Analysis unavailable — …_");
// matching mid-text would faint a real report that merely uses the phrase.
const FAINTED = /^\s*_?\s*(?:analysis unavailable|critical review (?:could not be generated|unavailable))/i

export const SIGNATURE_MAX = 120

/** Strip inline markdown: bold/italic/code markers and links (keeping link text). */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*>\s?/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cut to `max` characters on a word boundary, adding an ellipsis when cut. */
export function truncate(text: string, max = SIGNATURE_MAX): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  // Only back off to a space when the cut lands mid-word
  const midWord = !/\s/.test(text[max - 1])
  const lastSpace = cut.lastIndexOf(' ')
  const kept = midWord && lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return kept.replace(/[\s,;:–—-]+$/, '') + '…'
}

/**
 * The first bullet of the report; else the first line that is neither a heading nor a
 * whole-line bold label (reports open with "# The Banker's Verdict", and the Skeptic
 * writes bold-label paragraphs); else the first line.
 */
export function signatureLine(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim())
  const bullet = lines.find((l) => BULLET.test(l))
  const prose = lines.find((l) => !HEADING.test(l) && !BOLD_LABEL.test(l))
  const chosen = bullet ? bullet.replace(BULLET, '') : prose ?? lines[0] ?? ''
  return truncate(plainText(chosen))
}

/** The backend reports failed agents with these phrases instead of an error. */
export function isFainted(content: string): boolean {
  return !content.trim() || FAINTED.test(content)
}
