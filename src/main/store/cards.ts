import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ulid } from '../id'
import { parseCardFile, serializeCardFile } from '../markdown/parse'
import { atomicWrite, hashBody } from '../atomic-write'
import { cardsDir, namespaceFromPath } from '../paths'
import type { CardFull, CardMeta } from '../../shared/schema'

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
  args: { namespace: string; question: string; body: string; tags?: string[] }
): Promise<CardFull> {
  const id = ulid()
  const now = new Date().toISOString()
  const dir = path.join(cardsDir(rootPath), args.namespace)
  await fs.mkdir(dir, { recursive: true })
  const slug = slugify(args.question)
  const file = path.join(dir, `${slug || id}.md`)
  const raw = serializeCardFile(
    { id, question: args.question, tags: args.tags ?? [], created: now },
    args.body
  )
  await atomicWrite(file, raw)
  return readCardAtPath(rootPath, file)
}

export async function updateCardOnDisk(
  absPath: string,
  patch: { question?: string; body?: string; tags?: string[] }
): Promise<void> {
  const raw = await fs.readFile(absPath, 'utf8')
  const { frontmatter, body } = parseCardFile(raw)
  const nextFm = {
    ...frontmatter,
    question: patch.question ?? frontmatter.question,
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
