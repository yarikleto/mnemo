import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ulid } from '../id'
import { parseCardFile, serializeCardFile } from '../markdown/parse'
import { atomicWrite, hashBody } from '../atomic-write'
import { cardsDir, namespaceFromPath } from '../paths'
import type { CardFull, CardMeta, PromptFrontmatter } from '../../shared/schema'
import { promptPreview } from '../../shared/prompt'

export async function walkCardFiles(rootPath: string): Promise<string[]> {
  const root = cardsDir(rootPath)
  await fs.mkdir(root, { recursive: true })
  const out: string[] = []
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
    }
  }
  await walk(root)
  return out
}

export async function readCardAtPath(rootPath: string, absPath: string): Promise<CardFull> {
  const raw = await fs.readFile(absPath, 'utf8')
  const { frontmatter, body } = parseCardFile(raw)
  const stat = await fs.stat(absPath)
  return {
    ...frontmatter,
    namespace: namespaceFromPath(rootPath, absPath),
    path: absPath,
    mtime: stat.mtimeMs,
    bodyHash: hashBody(body),
    body
  }
}

export function toMeta(full: CardFull): CardMeta {
  const { body, ...meta } = full
  void body
  return meta
}

export async function createCardOnDisk(
  rootPath: string,
  args: { namespace: string; prompts: string[]; body: string; tags?: string[] }
): Promise<CardFull> {
  if (!args.prompts.length) throw new Error('At least one prompt is required')
  const id = ulid()
  const now = new Date().toISOString()
  const dir = path.join(cardsDir(rootPath), args.namespace)
  await fs.mkdir(dir, { recursive: true })
  const prompts: PromptFrontmatter[] = args.prompts.map(text => ({ id: ulid(), text }))
  const slug = slugify(promptPreview(prompts[0]!.text, 80))
  const file = await uniquePath(dir, slug || id, id)
  const raw = serializeCardFile(
    { id, prompts, tags: args.tags ?? [], created: now },
    args.body
  )
  await atomicWrite(file, raw)
  return readCardAtPath(rootPath, file)
}

export async function updateCardOnDisk(
  absPath: string,
  patch: { prompts?: PromptFrontmatter[]; body?: string; tags?: string[] }
): Promise<void> {
  const raw = await fs.readFile(absPath, 'utf8')
  const { frontmatter, body } = parseCardFile(raw)
  const nextFm = {
    ...frontmatter,
    prompts: patch.prompts ?? frontmatter.prompts,
    tags: patch.tags ?? frontmatter.tags
  }
  const nextBody = patch.body ?? body
  await atomicWrite(absPath, serializeCardFile(nextFm, nextBody))
}

export async function moveCardOnDisk(
  rootPath: string,
  currentPath: string,
  newNamespace: string
): Promise<string> {
  const dir = path.join(cardsDir(rootPath), newNamespace)
  await fs.mkdir(dir, { recursive: true })
  const newPath = path.join(dir, path.basename(currentPath))
  await fs.rename(currentPath, newPath)
  return newPath
}

export async function deleteCardOnDisk(absPath: string): Promise<void> {
  await fs.unlink(absPath)
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function uniquePath(dir: string, base: string, id: string): Promise<string> {
  const first = path.join(dir, `${base}.md`)
  if (!(await exists(first))) return first
  const suffix = id.slice(-6).toLowerCase()
  const withSuffix = path.join(dir, `${base}-${suffix}.md`)
  if (!(await exists(withSuffix))) return withSuffix
  return path.join(dir, `${base}-${id.toLowerCase()}.md`)
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}
