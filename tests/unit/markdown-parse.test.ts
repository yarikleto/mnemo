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

  it('roundtrips a prompt whose body contains a bare --- line', () => {
    const fm = {
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text: 'before\n---\nafter' }],
      tags: [],
      created: '2026-04-23T10:00:00.000Z'
    }
    const raw = serializeCardFile(fm, 'Body\n')
    const parsed = parseCardFile(raw)
    expect(parsed.frontmatter).toEqual(fm)
    expect(parsed.body.trim()).toBe('Body')
  })

  // Regression: a block scalar without an explicit indentation indicator takes
  // its indent from the first content line, so a prompt whose first line is
  // indented made every later, shallower line a YAML error. The card then failed
  // to parse and silently vanished from the index.
  it.each([
    ['indented first line', '  def cache(key):\n      return store[key]\nprint(cache("a"))'],
    ['deeply indented first line', '        far right\nback to zero'],
    ['fenced code with indent', '```py\n  x = 1\nreturn x\n```'],
    ['blank line inside', 'para one\n\npara two'],
    ['tab-indented first line', '\tindented\nplain'],
    ['trailing spaces', 'trailing   \nnext'],
    ['yaml-looking content', '---\nkey: value\n---'],
    ['colon-prefixed lines', 'a: 1\nb: 2']
  ])('roundtrips a multi-line prompt with %s', (_label, text) => {
    const fm = {
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text }],
      tags: [],
      created: '2026-04-23T10:00:00.000Z'
    }
    const parsed = parseCardFile(serializeCardFile(fm, 'Body\n'))
    expect(parsed.frontmatter).toEqual(fm)
    expect(parsed.body.trim()).toBe('Body')
  })

  it('normalises CRLF in a prompt instead of emitting a broken scalar', () => {
    const fm = {
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text: 'first\r\nsecond' }],
      tags: [],
      created: '2026-04-23T10:00:00.000Z'
    }
    const parsed = parseCardFile(serializeCardFile(fm, 'Body\n'))
    expect(parsed.frontmatter.prompts[0]!.text).toBe('first\nsecond')
  })

  it('roundtrips a tag containing a line break', () => {
    const fm = {
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text: 'Q?' }],
      tags: ['plain', 'two\nlines'],
      created: '2026-04-23T10:00:00.000Z'
    }
    const parsed = parseCardFile(serializeCardFile(fm, 'Body\n'))
    expect(parsed.frontmatter.tags).toEqual(['plain', 'two\nlines'])
  })

  // A blank prompt serialises to an empty block scalar, which parses back as ''
  // and fails PromptTextSchema — the card would land on disk unreadable. The
  // schema rejects it at the boundary instead; this pins the serializer half.
  it.each(['\n', '\n\n', '   ', ' \t '])('rejects a blank prompt (%j) on read', (text) => {
    const raw = serializeCardFile({
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text }],
      tags: [],
      created: '2026-04-23T10:00:00.000Z'
    }, 'Body\n')
    expect(() => parseCardFile(raw)).toThrow()
  })

  it('is idempotent across repeated save cycles', () => {
    const text = '  def cache(key):\n      return store[key]\nprint(cache("a"))'
    const fm = {
      id: CARD_ID,
      prompts: [{ id: PROMPT_ID_A, text }],
      tags: ['t'],
      created: '2026-04-23T10:00:00.000Z'
    }
    const once = parseCardFile(serializeCardFile(fm, 'B\n')).frontmatter
    const twice = parseCardFile(serializeCardFile(once, 'B\n')).frontmatter
    expect(once).toEqual(fm)
    expect(twice).toEqual(once)
  })

  it('throws on missing required fields', () => {
    const raw = `---\ntags: [x]\n---\nbody\n`
    expect(() => parseCardFile(raw)).toThrow()
  })
})
