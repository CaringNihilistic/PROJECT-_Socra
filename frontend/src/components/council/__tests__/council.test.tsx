import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import sample from '../../../episode/__fixtures__/sampleSession.json'
import { episodeReducer, initialEpisode, type EpisodeState } from '../../../episode/reducer'
import { resultsFromSession } from '../../../episode/results'
import { signatureLine } from '../../../episode/signature'
import type { AgentReport, EpisodeEvent } from '../../../episode/events'
import { EpisodePlayer } from '../EpisodePlayer'
import { Results } from '../Results'
import { EpisodeDemo } from '../EpisodeDemo'

const session = sample as { id: string; initial_idea: string; masterplan: string; agent_reports: AgentReport[] }
const byKey = (k: string) => session.agent_reports.find((r) => r.key === k)!
const play = (events: EpisodeEvent[]) => events.reduce(episodeReducer, initialEpisode())
const render = (episode: EpisodeState) =>
  renderToStaticMarkup(<EpisodePlayer episode={episode} onSkip={() => {}} onClose={() => {}} onRetry={() => {}} />)

describe('EpisodePlayer', () => {
  it('scouting: professor dialog with the queries, and a Skip button', () => {
    const html = render(play([{ type: 'web_research', queries: ['api docs market size'] }]))
    expect(html).toContain('PROF. SOCRA')
    expect(html).toContain('api docs market size')
    expect(html).toContain('SKIP')
  })

  it('council: a reported creature shows its signature, a failed one faints', () => {
    const html = render(
      play([
        { type: 'agent_report', report: byKey('finance') },
        { type: 'agent_report', report: { ...byKey('risk'), content: '_Analysis unavailable — RateLimitError_' } },
      ]),
    )
    expect(html).toContain('THE COUNCIL DELIBERATES')
    // renderToStaticMarkup escapes quotes/ampersands, so compare the escaped signature
    const sig = signatureLine(byKey('finance').content).slice(0, 20)
    expect(html).toContain(sig)
    expect(html).toContain('Omenyx fainted!')
    expect(html).toContain('thinking')
  })

  it('plan: the trainer who owns the current section is speaking', () => {
    const upToTechStack = session.masterplan.slice(0, session.masterplan.indexOf('PHASE 1'))
    const html = render(play([{ type: 'agent_report', report: byKey('tech') }, { type: 'synthesis_token', delta: upToTechStack }]))
    expect(html).toContain('THE TRAINERS PRESENT')
    expect(html).toContain('>DEX<')
    expect(html).toContain('TECH STACK')
  })

  it('ambush and done: Team Glitch appears, then See results', () => {
    const ambush = play([{ type: 'synthesis_done', text: session.masterplan }, { type: 'agent_report', report: byKey('devils_advocate') }])
    expect(render(ambush)).toContain('AMBUSH! TEAM GLITCH')
    const done = render(episodeReducer(ambush, { type: 'done' }))
    expect(done).toContain('SEE RESULTS')
    expect(done).not.toContain('SKIP')
  })

  it('failed: a dropped stream offers Try again', () => {
    const html = render(play([{ type: 'agent_report', report: byKey('tech') }, { type: 'stream_error' }]))
    expect(html).toContain('CONNECTION LOST')
    expect(html).toContain('TRY AGAIN')
  })
})

describe('Results', () => {
  const renderResults = (data = resultsFromSession(session)) =>
    renderToStaticMarkup(
      <Results sessionId={session.id} idea={session.initial_idea} data={data} canReplay onReplay={() => {}} />,
    )

  it('renders every creature, Team Glitch and the trainer-presented plan', () => {
    const html = renderResults()
    for (const name of ['COINBIT', 'AUGURIN', 'RIVALIX', 'BEAVOLT', 'OMENYX']) expect(html).toContain(name)
    expect(html).toContain('TEAM GLITCH')
    expect(html).toContain('WATCH EPISODE')
    expect(html).toContain('>KAI<')
    expect(html).toContain('>DEX<')
    expect(html).toContain('PHASE 2: GROWTH')
  })

  it('explains a legacy session saved without council reports', () => {
    const html = renderResults(resultsFromSession({ masterplan: session.masterplan, agent_reports: [] }))
    expect(html).toContain('weren’t saved')
  })
})

describe('EpisodeDemo', () => {
  it('renders without the backend', () => {
    expect(renderToStaticMarkup(<EpisodeDemo />)).toContain('SIMULATE LIVE RUN')
  })
})
