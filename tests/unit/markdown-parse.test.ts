import { describe, it, expect } from 'vitest'
import { parseCardFile, serializeCardFile } from '../../src/main/markdown/parse'

describe('parseCardFile', () => {
  it('extracts frontmatter and body', () => {
    const raw = `---\nid: "abc"\nquestion: "What?"\ntags: [a, b]\ncreated: "2026-04-23T10:00:00.000Z"\n---\n\nBody **markdown** here.\n`
    const { frontmatter, body } = parseCardFile(raw)
    expect(frontmatter.id).toBe('abc')
    expect(frontmatter.question).toBe('What?')
    expect(frontmatter.tags).toEqual(['a', 'b'])
    expect(body.trim()).toBe('Body **markdown** here.')
  })

  it('roundtrips', () => {
    const fm = { id: 'x', question: 'Q?', tags: ['t'], created: '2026-04-23T10:00:00.000Z' }
    const body = 'Answer\n'
    const raw = serializeCardFile(fm, body)
    const parsed = parseCardFile(raw)
    expect(parsed.frontmatter).toEqual(fm)
    expect(parsed.body.trim()).toBe('Answer')
  })

  it('throws on missing required fields', () => {
    const raw = `---\ntags: [x]\n---\nbody\n`
    expect(() => parseCardFile(raw)).toThrow()
  })
})
