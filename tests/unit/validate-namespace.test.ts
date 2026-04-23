import { describe, it, expect } from 'vitest'
import { validateNamespace } from '../../src/main/archive/import'

describe('validateNamespace — path traversal rejection', () => {
  it('rejects ".."', () => {
    expect(() => validateNamespace('..')).toThrow()
  })

  it('rejects "../../.."', () => {
    expect(() => validateNamespace('../../..')).toThrow()
  })

  it('rejects "foo/../bar"', () => {
    expect(() => validateNamespace('foo/../bar')).toThrow()
  })

  it('rejects "foo/bar/../.."', () => {
    expect(() => validateNamespace('foo/bar/../..')).toThrow()
  })

  it('rejects absolute path "/abs"', () => {
    expect(() => validateNamespace('/abs')).toThrow()
  })

  it('rejects trailing slash "foo/"', () => {
    expect(() => validateNamespace('foo/')).toThrow()
  })

  it('rejects backslash "foo\\\\bar"', () => {
    expect(() => validateNamespace('foo\\bar')).toThrow()
  })

  it('rejects null byte in segment', () => {
    expect(() => validateNamespace('foo\0bar')).toThrow()
  })
})

describe('validateNamespace — valid inputs', () => {
  it('accepts simple name "foo"', () => {
    expect(validateNamespace('foo')).toBe('foo')
  })

  it('accepts nested path "foo/bar"', () => {
    expect(validateNamespace('foo/bar')).toBe('foo/bar')
  })

  it('accepts empty string (root namespace)', () => {
    expect(validateNamespace('')).toBe('')
  })

  it('accepts deeply nested "foo/bar/baz"', () => {
    expect(validateNamespace('foo/bar/baz')).toBe('foo/bar/baz')
  })

  it('trims surrounding whitespace', () => {
    expect(validateNamespace('  foo/bar  ')).toBe('foo/bar')
  })
})
