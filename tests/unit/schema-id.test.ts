import { describe, it, expect } from 'vitest'
import { CardFrontmatterSchema } from '../../src/shared/schema'
import { stateFile } from '../../src/main/paths'
import { ulid } from '../../src/main/id'

const VALID_CREATED = '2026-04-23T10:00:00.000Z'
const VALID_PROMPT_ID = '01KPXRNEDCVRX2NY8GBCP5PGJH'

function parseCard(id: string) {
  return CardFrontmatterSchema.parse({
    id,
    prompts: [{ id: VALID_PROMPT_ID, text: 'some question?' }],
    created: VALID_CREATED
  })
}

describe('CardFrontmatterSchema id validation', () => {
  it('rejects a path-traversal id', () => {
    expect(() => parseCard('../../../etc/passwd')).toThrow()
  })

  it('rejects a short arbitrary string', () => {
    expect(() => parseCard('foo')).toThrow()
  })

  it('rejects a too-short ULID-like value', () => {
    expect(() => parseCard('01JABCD')).toThrow()
  })

  it('rejects a lowercase ULID', () => {
    expect(() => parseCard('01jabcd000000000000000000a')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => parseCard('')).toThrow()
  })

  it('accepts a hardcoded valid 26-char Crockford ULID', () => {
    expect(() => parseCard('01KPXRNEDBCDJMEJNG622WTDJW')).not.toThrow()
  })

  it('accepts a freshly generated ulid()', () => {
    expect(() => parseCard(ulid())).not.toThrow()
  })
})

describe('stateFile path traversal guard', () => {
  it('throws when id would escape the state directory', () => {
    expect(() => stateFile('/tmp/root', '../../etc/passwd')).toThrow(/Unsafe state file id/)
  })

  it('resolves safely for a valid ULID', () => {
    const result = stateFile('/tmp/root', '01KPXRNEDBCDJMEJNG622WTDJW')
    expect(result).toBe('/tmp/root/state/01KPXRNEDBCDJMEJNG622WTDJW.json')
  })
})
