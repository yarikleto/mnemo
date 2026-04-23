import matter from 'gray-matter'
import { CardFrontmatterSchema, type CardFrontmatter } from '../../shared/schema'

export type ParsedCard = { frontmatter: CardFrontmatter; body: string }

export function parseCardFile(raw: string): ParsedCard {
  const parsed = matter(raw)
  const frontmatter = CardFrontmatterSchema.parse(parsed.data)
  return { frontmatter, body: parsed.content.replace(/^\n/, '') }
}

export function serializeCardFile(frontmatter: CardFrontmatter, body: string): string {
  const fmBlock = matter.stringify('', frontmatter).replace(/\n$/, '')
  return `${fmBlock}\n\n${body.endsWith('\n') ? body : body + '\n'}`
}
