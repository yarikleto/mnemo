import { describe, it, expect } from 'vitest'
import { CardFrontmatterSchema, ReviewStateSchema, ConfigSchema, DEFAULT_CONFIG } from '../../src/shared/schema'

// Valid 26-char Crockford Base32 ULIDs used as fixtures
const CARD_ID_A = '01KPXRNEDBCDJMEJNG622WTDJW'
const CARD_ID_B = '01KPXRNEDCXTKDDKFWQYJ9JA73'
const PROMPT_ID_1 = '01KPXRNEDC2R7D179WK9ESYHFX'
const PROMPT_ID_2 = '01KPXRNEDCSCZYP8JC53JK32QG'
const PROMPT_ID_P = '01KPXRNEDCVRX2NY8GBCP5PGJH'

describe('CardFrontmatterSchema', () => {
  it('accepts a valid frontmatter', () => {
    const fm = {
      id: CARD_ID_A,
      prompts: [{ id: PROMPT_ID_1, text: 'What is CAP theorem?' }],
      tags: ['distributed'],
      created: '2026-04-23T10:00:00.000Z'
    }
    expect(CardFrontmatterSchema.parse(fm)).toEqual(fm)
  })

  it('accepts multiple prompts', () => {
    const fm = {
      id: CARD_ID_A,
      prompts: [
        { id: PROMPT_ID_1, text: 'Q1' },
        { id: PROMPT_ID_2, text: 'Q2 — different phrasing' }
      ],
      tags: [],
      created: '2026-04-23T10:00:00.000Z'
    }
    expect(CardFrontmatterSchema.parse(fm).prompts).toHaveLength(2)
  })

  it('defaults tags to empty array', () => {
    const fm = { id: CARD_ID_B, prompts: [{ id: PROMPT_ID_P, text: 'q' }], created: '2026-04-23T10:00:00.000Z' }
    expect(CardFrontmatterSchema.parse(fm).tags).toEqual([])
  })

  it('rejects an empty prompts array', () => {
    expect(() => CardFrontmatterSchema.parse({
      id: CARD_ID_A, prompts: [], created: '2026-04-23T10:00:00.000Z'
    })).toThrow()
  })

  it('rejects missing prompts', () => {
    expect(() => CardFrontmatterSchema.parse({ id: CARD_ID_A, created: '2026-04-23T10:00:00.000Z' })).toThrow()
  })
})

describe('ReviewStateSchema', () => {
  it('accepts null last_review', () => {
    const state = {
      id: CARD_ID_A, due: '2026-04-25T00:00:00.000Z', stability: 1, difficulty: 5,
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
