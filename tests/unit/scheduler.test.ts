import { describe, it, expect } from 'vitest'
import { createScheduler, rateCard } from '../../src/main/fsrs/scheduler'
import { newState } from '../../src/main/store/state'

describe('rateCard', () => {
  it('advances a new card after "Good" rating', () => {
    const sched = createScheduler()
    const initial = newState('c1')
    const now = new Date('2026-04-23T10:00:00Z')
    const next = rateCard(sched, initial, 'Good', now)
    expect(next.reps).toBe(1)
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime())
    expect(next.state).not.toBe('New')
    expect(next.history).toHaveLength(1)
    expect(next.history[0]!.rating).toBe('Good')
  })

  it('increments lapses after "Again" on a reviewed card', () => {
    const sched = createScheduler()
    const initial = rateCard(sched, newState('c2'), 'Good', new Date('2026-04-23T10:00:00Z'))
    const lapsed = rateCard(sched, initial, 'Again', new Date('2026-04-24T10:00:00Z'))
    expect(lapsed.lapses).toBeGreaterThanOrEqual(initial.lapses)
    expect(['Learning', 'Relearning']).toContain(lapsed.state)
  })
})
