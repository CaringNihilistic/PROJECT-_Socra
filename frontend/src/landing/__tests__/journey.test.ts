import { describe, expect, it } from 'vitest'
import { STAGES } from '../../pixel/cast'
import { JOURNEY, JOURNEY_MS, SCENE_START, journeyFrame, sceneAt } from '../journey'

const [egg, hatchling, , final] = STAGES

describe('journey timeline', () => {
  it('plays the scenes in order', () => {
    expect([0, 3499, 3500, 5000, 8500, 15000, 20000, 22999].map(sceneAt)).toEqual([
      'ask', 'ask', 'answer', 'evolve', 'council', 'plan', 'end', 'end',
    ])
  })

  it('wraps at the end of the loop', () => {
    expect(journeyFrame(JOURNEY_MS + 100)).toEqual(journeyFrame(100))
    expect(journeyFrame(-1).scene).toBe('end')
  })

  it('moves the menu cursor 0 → 1 → 0, then picks choice 0', () => {
    expect([0, 1400, 2400].map((t) => journeyFrame(t).cursor)).toEqual([0, 1, 0])
    expect(journeyFrame(2900).picking).toBe(false)
    expect(journeyFrame(3000).picking).toBe(true)
    expect(journeyFrame(SCENE_START.answer).cursor).toBeNull()
  })

  it('uses the recorded scores and evolves the egg mid-scene', () => {
    expect(journeyFrame(0)).toMatchObject({ stage: egg, score: JOURNEY.before.total_score })
    expect(journeyFrame(5000)).toMatchObject({ stage: egg, score: JOURNEY.after.total_score, evolved: false })
    expect(journeyFrame(7400)).toMatchObject({ stage: hatchling, evolved: true })
    expect(journeyFrame(8500)).toMatchObject({ stage: final, score: JOURNEY.final.total_score })
  })

  it('lands the five council reports one by one', () => {
    const done = (t: number) => journeyFrame(t).episode!.seats.filter((s) => s.status === 'done').length
    expect(journeyFrame(8499).episode).toBeNull()
    expect([8500, 9300, 10300, 11300, 12300, 13300, 14999].map(done)).toEqual([0, 1, 2, 3, 4, 5, 5])
    expect(journeyFrame(13300).episode!.seats.every((s) => s.signature)).toBe(true)
  })

  it('types the plan out steadily, then finishes it', () => {
    const plan = (t: number) => journeyFrame(t).episode!.plan
    const lengths = [15000, 16000, 17000, 18000, 19000].map((t) => plan(t).text.length)
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b))
    expect(lengths[4]).toBeGreaterThan(lengths[1])
    expect(plan(19500)).toEqual({ status: 'done', text: JOURNEY.plan })
    expect(journeyFrame(19500).episode!.beat).toBe('plan')
  })
})
