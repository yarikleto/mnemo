import { describe, it, expect } from 'vitest'
import { CardFrontmatterSchema, ReviewStateSchema, ConfigSchema, DEFAULT_CONFIG } from '../../src/shared/schema'

describe('CardFrontmatterSchema', () => {
  it('accepts a valid frontmatter', () => {
    const fm = {
      id: '01HXYZ',
      question: 'What is CAP theorem?',
      tags: ['distributed'],
      created: '2026-04-23T10:00:00.000Z'
    }
    expect(CardFrontmatterSchema.parse(fm)).toEqual(fm)
  })

  it('defaults tags to empty array', () => {
    const fm = { id: '1', question: 'q', created: '2026-04-23T10:00:00.000Z' }
    expect(CardFrontmatterSchema.parse(fm).tags).toEqual([])
  })

  it('rejects missing question', () => {
    expect(() => CardFrontmatterSchema.parse({ id: '1', created: '2026-04-23T10:00:00.000Z' })).toThrow()
  })
})

describe('ReviewStateSchema', () => {
  it('accepts null last_review', () => {
    const state = {
      id: '1', due: '2026-04-25T00:00:00.000Z', stability: 1, difficulty: 5,
      elapsed_days: 0, scheduled_days: 1, reps: 0, lapses: 0, state: 'New' as const,
      last_review: null, history: []
    }
    expect(ReviewStateSchema.parse(state)).toEqual(state)
  })
})

describe('ConfigSchema', () => {
  it('parses a default config with a root path', () => {
    const parsed = ConfigSchema.parse({ rootPath: '/tmp/x', ...DEFAULT_CONFIG })
    expect(parsed.rootPath).toBe('/tmp/x')
    expect(parsed.dashboard.widgets).toHaveLength(6)
  })
})
