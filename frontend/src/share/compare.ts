/**
 * The /compare VS screen's data: stat pairs with a leader, and council signature pairs.
 * docs/superpowers/specs/2026-09-30-socra-share-pages-design.md §4
 */
import { COUNCIL, type CouncilKey } from '../pixel/cast'
import { STAT_ROWS, type StatKey } from '../chat/turns'
import { isFainted, signatureLine } from '../episode/signature'
import type { AgentReport } from '../episode/events'

type Scores = Partial<Record<StatKey, number>>

export interface StatPair {
  key: StatKey
  label: string
  /** Rounded percents */
  a: number
  b: number
  leader: 'a' | 'b' | 'tie'
}

export function statPairs(a: Scores, b: Scores): StatPair[] {
  return STAT_ROWS.map(({ key, label }) => {
    const pa = Math.round((a[key] ?? 0) * 100)
    const pb = Math.round((b[key] ?? 0) * 100)
    return { key, label, a: pa, b: pb, leader: pa === pb ? 'tie' : pa > pb ? 'a' : 'b' }
  })
}

export interface CouncilPair {
  key: CouncilKey
  /** The signature line, or null when the report is missing or failed */
  a: string | null
  b: string | null
}

const signatureOf = (reports: readonly AgentReport[] | undefined, key: string): string | null => {
  const report = reports?.find((r) => r.key === key)
  if (!report?.content || isFainted(report.content)) return null
  return signatureLine(report.content) || null
}

export function councilPairs(a: readonly AgentReport[] | undefined, b: readonly AgentReport[] | undefined): CouncilPair[] {
  return (Object.keys(COUNCIL) as CouncilKey[]).map((key) => ({ key, a: signatureOf(a, key), b: signatureOf(b, key) }))
}
