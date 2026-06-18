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
    for (const t of frontmatter.tags) lines.push(`  - ${yamlSingleQuoted(t)}`)
  }
  lines.push(`created: '${frontmatter.created}'`)
  lines.push('---')
  lines.push('')
  const prefix = lines.join('\n')
  return `${prefix}\n${body.endsWith('\n') ? body : body + '\n'}`
}

function renderPrompt(p: PromptFrontmatter): string[] {
  const head = `  - id: ${p.id}`
  if (p.text.includes('\n')) {
    const out = [head, '    text: |-']
    for (const line of p.text.replace(/\n+$/, '').split('\n')) out.push(`      ${line}`)
    return out
  }
  return [head, `    text: ${yamlSingleQuoted(p.text)}`]
}

function yamlSingleQuoted(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
