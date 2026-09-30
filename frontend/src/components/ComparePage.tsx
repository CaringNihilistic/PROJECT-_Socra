import { useEffect, useState } from 'react'
import axios from 'axios'
import type { SessionData } from '../store/sessionStore'
import { COUNCIL } from '../pixel/cast'
import { Sprite } from '../pixel/Sprite'
import { PixelPanel } from '../pixel/ui/PixelPanel'
import { stageForSession } from '../chat/turns'
import { councilPairs, statPairs, type StatPair } from '../share/compare'
import { Loading, NotFound, PublicShell, RunYourIdea } from './share/ShareChrome'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type Side = 'a' | 'b'
const NAME: Record<Side, string> = { a: 'IDEA A', b: 'IDEA B' }
const LABEL: Record<Side, string> = { a: 'Idea A', b: 'Idea B' }

function Fighter({ session, side }: { session: SessionData | null; side: Side }) {
  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center gap-3 text-center">
        <p className="font-pixel text-[10px] text-px-muted">{NAME[side]}</p>
        <p className="text-px-glitch-text">{LABEL[side]} couldn’t be loaded.</p>
      </div>
    )
  }
  const stage = stageForSession(session)
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
      <p className="font-pixel text-[10px] text-px-muted">{NAME[side]}</p>
      <div className="border-4 border-px-ink bg-px-screen p-2">
        {/* B faces A: mirrored, still whole pixels */}
        <Sprite name={stage.sprite} size={128} label={stage.name} className={side === 'b' ? 'scale-x-[-1]' : ''} />
      </div>
      <p className="font-pixel text-[10px] leading-relaxed text-px-xp">
        {stage.name.toUpperCase()} · HP {Math.round(session.total_score * 100)}
      </p>
      <p className="line-clamp-3 text-px-soft">{session.initial_idea}</p>
    </div>
  )
}

function StatRow({ pair }: { pair: StatPair }) {
  const value = (side: Side) => (side === 'a' ? pair.a : pair.b)
  const lead = (side: Side) => pair.leader === side
  const bar = (side: Side) => (
    <div
      role="meter"
      aria-label={`${LABEL[side]} ${pair.label.toLowerCase()}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value(side)}
      className={`flex h-3 flex-1 border-2 border-px-ink bg-px-night ${side === 'a' ? 'justify-end' : ''}`}
    >
      <div className={lead(side) ? 'bg-px-xp' : 'bg-px-plan'} style={{ width: `${value(side)}%` }} />
    </div>
  )
  const number = (side: Side) => (
    <span className={`w-9 shrink-0 text-center ${lead(side) ? 'text-px-xp' : 'text-px-soft'}`}>{value(side)}</span>
  )
  return (
    <li className="flex flex-col gap-1">
      <span className="text-center text-[20px] text-px-muted">{pair.label}</span>
      <div className="flex items-center gap-2">
        {number('a')}
        {bar('a')}
        <span aria-hidden="true" className="text-px-edge">|</span>
        {bar('b')}
        {number('b')}
      </div>
    </li>
  )
}

export function VsScreen({ a, b, ids }: { a: SessionData | null; b: SessionData | null; ids: [string, string] }) {
  const stats = a && b ? statPairs(a.scores, b.scores) : []
  const council = councilPairs(a?.agent_reports, b?.agent_reports)

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="The two ideas" className="pixel-panel flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-start sm:p-8">
        <Fighter session={a} side="a" />
        <p aria-hidden="true" className="self-center font-pixel text-[32px] text-px-glitch-text [text-shadow:4px_4px_0_theme(colors.px.glitch-dark)]">VS</p>
        <Fighter session={b} side="b" />
      </section>

      {stats.length > 0 && (
        <PixelPanel title="STATS">
          <p className="mb-4 text-[20px] text-px-muted">Idea A on the left, Idea B on the right. The higher side is gold.</p>
          <ul className="flex flex-col gap-3">
            {stats.map((pair) => (
              <StatRow key={pair.key} pair={pair} />
            ))}
          </ul>
        </PixelPanel>
      )}

      <PixelPanel title="THE COUNCIL">
        <ul className="flex flex-col gap-6">
          {council.map((pair) => {
            const creature = COUNCIL[pair.key]
            return (
              <li key={pair.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Sprite name={creature.sprite} size={64} />
                  <div>
                    <p className="font-pixel text-[10px] leading-relaxed">{creature.name.toUpperCase()}</p>
                    <p className="text-[20px] text-px-muted">{creature.advisor}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['a', 'b'] as const).map((side) => (
                    <div key={side} className="flex gap-2 border-2 border-px-edge bg-px-night px-3 py-2">
                      <span className="font-pixel text-[10px] leading-relaxed text-px-muted">{side.toUpperCase()}</span>
                      <p className={pair[side] ? 'text-px-soft' : 'text-px-muted'}>{pair[side] ? `“${pair[side]}”` : 'No report'}</p>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </PixelPanel>

      <div className="flex flex-wrap gap-3">
        {a?.masterplan && (
          <a href={`/share/${ids[0]}`} className="pixel-btn pixel-btn-secondary inline-flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-px-plan">
            READ PLAN A ▶
          </a>
        )}
        {b?.masterplan && (
          <a href={`/share/${ids[1]}`} className="pixel-btn pixel-btn-secondary inline-flex items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-px-plan">
            READ PLAN B ▶
          </a>
        )}
        <RunYourIdea />
      </div>
    </div>
  )
}

export function ComparePage({ id1, id2 }: { id1: string; id2: string }) {
  const [pair, setPair] = useState<[SessionData | null, SessionData | null] | null>(null)

  useEffect(() => {
    const load = (id: string) =>
      axios
        .get<SessionData>(`${API_URL}/sessions/${id}`)
        .then(({ data }) => data)
        .catch(() => null)
    Promise.all([load(id1), load(id2)]).then(setPair)
  }, [id1, id2])

  return (
    <PublicShell section="COMPARE">
      {!pair && <Loading what="BOTH IDEAS" />}
      {pair && !pair[0] && !pair[1] && <NotFound message="Neither idea could be found. Two new ones, then?" />}
      {pair && (pair[0] || pair[1]) && <VsScreen a={pair[0]} b={pair[1]} ids={[id1, id2]} />}
    </PublicShell>
  )
}
