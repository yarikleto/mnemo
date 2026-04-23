import { describe, it, expect } from 'vitest'
import { parseCardFile, serializeCardFile } from '../../src/main/markdown/parse'

describe('parseCardFile', () => {
  it('extracts frontmatter and body', () => {
    const raw = [
      '---',
      'id: abc',
      'prompts:',
      '  - id: p1',
      "    text: 'What?'",
      'tags:',
      '  - a',
      '  - b',
      "created: '2026-04-23T10:00:00.000Z'",
      '---',
      '',
      'Body **markdown** here.',
      ''
    ].join('\n')
    const { frontmatter, body } = parseCardFile(raw)
    expect(frontmatter.id).toBe('abc')
    expect(frontmatter.prompts).toEqual([{ id: 'p1', text: 'What?' }])
    expect(frontmatter.tags).toEqual(['a', 'b'])
    expect(body.trim()).toBe('Body **markdown** here.')
  })

  it('roundtrips a card with multiple prompts', () => {
    const fm = {
      id: 'x',
      prompts: [
        { id: 'pA', text: 'Short prompt?' },
        { id: 'pB', text: 'line one\nline two\n![](./assets/x.png)' }
      ],
      tags: ['t'],
      created: '2026-04-23T10:00:00.000Z'
    }
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
