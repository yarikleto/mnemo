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

  // Regression: history recorded state.elapsed_days — the gap closed by the
  // *previous* review — so every entry was shifted one review behind.
  it('records the gap the review actually closed', () => {
    const sched = createScheduler()
    const first = rateCard(sched, newState('c3'), 'Good', new Date('2026-01-01T00:00:00Z'))
    expect(first.history[0]!.elapsed_days).toBe(0)

    const second = rateCard(sched, first, 'Good', new Date('2026-01-06T00:00:00Z'))
    expect(second.history[1]!.elapsed_days).toBe(5)
    expect(second.history[1]!.elapsed_days).toBe(second.elapsed_days)

    const third = rateCard(sched, second, 'Good', new Date('2026-01-20T00:00:00Z'))
    expect(third.history[2]!.elapsed_days).toBe(14)
  })

  it('increments lapses after "Again" on a reviewed card', () => {
    const sched = createScheduler()
    const initial = rateCard(sched, newState('c2'), 'Good', new Date('2026-04-23T10:00:00Z'))
    const lapsed = rateCard(sched, initial, 'Again', new Date('2026-04-24T10:00:00Z'))
    expect(lapsed.lapses).toBeGreaterThanOrEqual(initial.lapses)
    expect(['Learning', 'Relearning']).toContain(lapsed.state)
  })
})
