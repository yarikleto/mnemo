import { describe, it, expect } from 'vitest'
import { parseCardFile, serializeCardFile } from '../../src/main/markdown/parse'

// Valid 26-char Crockford Base32 ULIDs used as fixtures
const CARD_ID = '01KPXRNEDBCDJMEJNG622WTDJW'
const PROMPT_ID_1 = '01KPXRNEDC2R7D179WK9ESYHFX'
const PROMPT_ID_A = '01KPXRNEDCSCZYP8JC53JK32QG'
const PROMPT_ID_B = '01KPXRNEDCVRX2NY8GBCP5PGJH'

describe('parseCardFile', () => {
  it('extracts frontmatter and body', () => {
    const raw = [
      '---',
      `id: ${CARD_ID}`,
      'prompts:',
      `  - id: ${PROMPT_ID_1}`,
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
    expect(frontmatter.id).toBe(CARD_ID)
    expect(frontmatter.prompts).toEqual([{ id: PROMPT_ID_1, text: 'What?' }])
    expect(frontmatter.tags).toEqual(['a', 'b'])
    expect(body.trim()).toBe('Body **markdown** here.')
  })

  it('roundtrips a card with multiple prompts', () => {
    const fm = {
      id: CARD_ID,
      prompts: [
        { id: PROMPT_ID_A, text: 'Short prompt?' },
        { id: PROMPT_ID_B, text: 'line one\nline two\n![](./assets/x.png)' }
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
