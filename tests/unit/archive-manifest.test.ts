import { describe, it, expect } from 'vitest'
import { ManifestSchema, assertSupportedVersion, ARCHIVE_VERSION } from '../../src/main/archive/manifest'

describe('archive manifest', () => {
  it('accepts a v1 manifest', () => {
    const parsed = ManifestSchema.parse({
      version: 1,
      exportedAt: new Date().toISOString(),
      cardCount: 3
    })
    expect(parsed.warnings).toEqual([])
  })

  it('rejects missing fields', () => {
    expect(() => ManifestSchema.parse({ version: 1 })).toThrow()
  })

  it('rejects future versions via assertSupportedVersion', () => {
    expect(() => assertSupportedVersion(ARCHIVE_VERSION + 1)).toThrow(/newer/)
  })

  it('accepts the current version', () => {
    expect(() => assertSupportedVersion(ARCHIVE_VERSION)).not.toThrow()
  })
})
