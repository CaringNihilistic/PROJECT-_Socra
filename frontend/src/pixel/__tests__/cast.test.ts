import { describe, expect, it } from 'vitest'
import {
  COUNCIL, STAGES, TEAM_GLITCH, TRAINERS,
  councilForAgentKey, nextStage, stageForPhase, stageForScore, trainerForHeading,
} from '../cast'

describe('councilForAgentKey', () => {
  // Must match the agent keys in backend/llm_client.py COUNCIL_SEATS
  it.each([
    ['finance', 'Coinbit'],
    ['market', 'Augurin'],
    ['competition', 'Rivalix'],
    ['tech', 'Beavolt'],
    ['risk', 'Omenyx'],
  ])('%s → %s', (key, name) => {
    const member = councilForAgentKey(key)
    expect(member).toEqual({ kind: 'creature', creature: COUNCIL[key as keyof typeof COUNCIL] })
    expect(member?.kind === 'creature' && member.creature.name).toBe(name)
  })

  it("devils_advocate → Team Glitch", () => {
    expect(councilForAgentKey('devils_advocate')).toEqual({ kind: 'glitch', team: TEAM_GLITCH })
  })

  it('unknown keys → null, including inherited object properties', () => {
    expect(councilForAgentKey('growth')).toBeNull()
    expect(councilForAgentKey('toString')).toBeNull()
  })
})

describe('stages', () => {
  it.each([
    ['intake', 'Idea Egg'],
    ['debate', 'Hatchling'],
    ['stress_test', 'Evolved'],
    ['masterplan', 'Final Form'],
    ['something_new', 'Idea Egg'],
  ])('phase %s → %s', (phase, name) => {
    expect(stageForPhase(phase).name).toBe(name)
  })

  // Thresholds mirror backend/eval_bar.py PHASE_THRESHOLDS
  it.each([
    [0, 'Idea Egg'],
    [0.39, 'Idea Egg'],
    [0.4, 'Hatchling'],
    [0.69, 'Hatchling'],
    [0.7, 'Evolved'],
    [0.8, 'Final Form'],
    [1, 'Final Form'],
  ])('score %s → %s', (score, name) => {
    expect(stageForScore(score).name).toBe(name)
  })

  it('nextStage walks the line and ends at Final Form', () => {
    expect(nextStage(STAGES[0])?.name).toBe('Hatchling')
    expect(nextStage(STAGES[3])).toBeNull()
  })
})

describe('trainerForHeading', () => {
  // Headings from backend/llm_client.py _build_synthesis_prompt
  it.each([
    ["Chairman's Verdict", TRAINERS.kai],
    ['Tech Stack', TRAINERS.dex],
    ['Phase 1: MVP (Weeks 1-8)', TRAINERS.kai],
    ['Phase 2: Growth (Months 3-9)', TRAINERS.kai],
    ['Phase 3: Scale/Moat (Months 9-18)', TRAINERS.kai],
    ['Risk Register', TRAINERS.marin],
    ['First 3 files to write', TRAINERS.dex],
    ['Monthly cost estimate', TRAINERS.dex],
    ['Something unexpected', TRAINERS.kai],
  ])('%s', (heading, trainer) => {
    expect(trainerForHeading(heading)).toBe(trainer)
  })
})
