import { load } from 'js-yaml'
import { CardFrontmatterSchema, type CardFrontmatter, type PromptFrontmatter } from '../../shared/schema'

export type ParsedCard = { frontmatter: CardFrontmatter; body: string }

export function parseCardFile(raw: string): ParsedCard {
  const { data, content } = splitFrontmatter(raw)
  const frontmatter = CardFrontmatterSchema.parse(data)
  return { frontmatter, body: content.replace(/^\n/, '') }
}

// Split a card file into its YAML front-matter object and the markdown body.
// We own the serializer above, so we only need to invert what it can emit — but
// the close fence is matched column-0 anchored (`^---$`), never `.trim()`'d, so
// a prompt whose body contains a `---` line (indented under a block scalar) does
// not get mistaken for the end of the front-matter. The body is sliced from the
// original string so its bytes (including CRLF) survive untouched.
function splitFrontmatter(raw: string): { data: unknown; content: string } {
  // Strip a leading BOM so the opening fence is recognised.
  const str = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw

  const open = /^---[ \t]*\r?\n/.exec(str)
  if (!open) return { data: {}, content: str }

  const rest = str.slice(open[0].length)
  const close = /^---[ \t]*$/m.exec(rest)
  if (!close) return { data: {}, content: str }

  const yamlBlock = rest.slice(0, close.index)
  let contentStart = close.index + close[0].length
  if (rest[contentStart] === '\r') contentStart++
  if (rest[contentStart] === '\n') contentStart++

  const data = yamlBlock.trim() === '' ? {} : load(yamlBlock)
  return { data: data ?? {}, content: rest.slice(contentStart) }
}

export function serializeCardFile(frontmatter: CardFrontmatter, body: string): string {
  const lines: string[] = ['---']
  lines.push(`id: ${frontmatter.id}`)
  lines.push('prompts:')
  for (const p of frontmatter.prompts) lines.push(...renderPrompt(p))
  if (frontmatter.tags.length === 0) {
    lines.push('tags: []')
  } else {
    lines.push('tags:')
    for (const t of frontmatter.tags) lines.push(`  - ${yamlScalar(t)}`)
  }
  lines.push(`created: '${frontmatter.created}'`)
  lines.push('---')
  lines.push('')
  const prefix = lines.join('\n')
  return `${prefix}\n${body.endsWith('\n') ? body : body + '\n'}`
}

// Indentation of a block scalar's content, relative to its parent mapping key
// (`    text:` sits at column 4, content lines at column 6).
const BLOCK_INDENT = 2
const BLOCK_PAD = ' '.repeat(4 + BLOCK_INDENT)

function renderPrompt(p: PromptFrontmatter): string[] {
  const head = `  - id: ${p.id}`
  if (!/[\r\n]/.test(p.text)) return [head, `    text: ${yamlScalar(p.text)}`]

  // A block scalar without an explicit indentation indicator takes its indent
  // from the first content line, so a prompt starting with whitespace ("  def
  // foo():") makes every subsequent, less-indented line a YAML syntax error and
  // the card silently drops out of the index. `|2-` pins the indent up front.
  const out = [head, `    text: |${BLOCK_INDENT}-`]
  const text = p.text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  for (const line of text.split('\n')) out.push(line === '' ? '' : `${BLOCK_PAD}${line}`)
  return out
}

// Single-quoted YAML can't carry line breaks or control characters at this
// indentation, so fall back to a double-quoted scalar (JSON's escaping is a
// strict subset of YAML's) whenever the value isn't plain text.
function yamlScalar(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(s)) return JSON.stringify(s)
  return `'${s.replace(/'/g, "''")}'`
}
