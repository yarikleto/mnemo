import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from '../../src/main/concurrency'

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const items = [30, 5, 20, 1, 15]
    const out = await mapWithConcurrency(items, async n => {
      await new Promise(r => setTimeout(r, n))
      return n * 2
    }, 3)
    expect(out).toEqual([60, 10, 40, 2, 30])
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    await mapWithConcurrency(Array.from({ length: 40 }, (_, i) => i), async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 1))
      inFlight--
    }, 4)
    expect(peak).toBe(4)
  })

  it('handles an empty input and a limit larger than the input', async () => {
    expect(await mapWithConcurrency([], async () => 1)).toEqual([])
    expect(await mapWithConcurrency([1, 2], async n => n + 1, 99)).toEqual([2, 3])
  })

  it('propagates the first rejection', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], async n => {
        if (n === 2) throw new Error('boom')
        return n
      }, 2)
    ).rejects.toThrow('boom')
  })

  it('passes the index through', async () => {
    expect(await mapWithConcurrency(['a', 'b', 'c'], async (v, i) => `${i}:${v}`, 2))
      .toEqual(['0:a', '1:b', '2:c'])
  })
})
