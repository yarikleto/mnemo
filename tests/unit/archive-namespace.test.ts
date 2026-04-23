import { describe, it, expect } from 'vitest'
import { validateNamespace } from '../../src/main/archive/import'
import { referencedAssets } from '../../src/main/archive/export'

describe('validateNamespace', () => {
  it('allows empty string for root', () => {
    expect(validateNamespace('')).toBe('')
    expect(validateNamespace('  ')).toBe('')
  })
  it('allows nested paths', () => {
    expect(validateNamespace('imported/friend')).toBe('imported/friend')
  })
  it('rejects leading slash', () => {
    expect(() => validateNamespace('/foo')).toThrow()
  })
  it('rejects trailing slash', () => {
    expect(() => validateNamespace('foo/')).toThrow()
  })
  it('rejects path traversal', () => {
    expect(() => validateNamespace('foo/../bar')).toThrow()
    expect(() => validateNamespace('..')).toThrow()
  })
  it('rejects empty segments from double slashes', () => {
    expect(() => validateNamespace('a//b')).toThrow()
  })
  it('rejects backslash', () => {
    expect(() => validateNamespace('foo\\bar')).toThrow()
  })
})

describe('referencedAssets', () => {
  it('extracts markdown image references', () => {
    const body = 'text ![alt](./assets/a.png) ...'
    expect(referencedAssets(body)).toEqual(['a.png'])
  })
  it('extracts html img src', () => {
    const body = 'text <img src="./assets/b.jpg" /> ...'
    expect(referencedAssets(body)).toEqual(['b.jpg'])
  })
  it('dedupes repeats', () => {
    const body = '![x](./assets/x.png) and again ![y](./assets/x.png)'
    expect(referencedAssets(body)).toEqual(['x.png'])
  })
  it('ignores non-assets paths', () => {
    const body = '![](./other/z.png) ![](../assets/z.png)'
    expect(referencedAssets(body)).toEqual([])
  })
})
