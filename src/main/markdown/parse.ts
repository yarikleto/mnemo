import matter from 'gray-matter'
import { CardFrontmatterSchema, type CardFrontmatter, type PromptFrontmatter } from '../../shared/schema'

export type ParsedCard = { frontmatter: CardFrontmatter; body: string }

export function parseCardFile(raw: string): ParsedCard {
  const parsed = matter(raw)
  const frontmatter = CardFrontmatterSchema.parse(parsed.data)
  return { frontmatter, body: parsed.content.replace(/^\n/, '') }
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
