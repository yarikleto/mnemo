import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { parseCardFile, serializeCardFile } from '../markdown/parse'
import { atomicWrite, hashBody } from '../atomic-write'
import { cardsDir } from '../paths'
import { readCardAtPath } from '../store/cards'
import { ManifestSchema, assertSupportedVersion, type Manifest } from './manifest'
import { CardFrontmatterSchema } from '../../shared/schema'
import type { CardIndex } from '../store/index'
import type { ImportSummary } from '../../shared/api'
import { referencedAssets } from './export'

type ImportCtx = {
  rootPath: string
  index: CardIndex
  watcher: { suppressNext: (path: string, mtime: number, hash: string) => void }
  win: { webContents: { send: (channel: string, ...args: unknown[]) => void } }
}

export async function readManifest(zipPath: string): Promise<Manifest> {
  const buf = await fs.readFile(zipPath)
  const zip = await JSZip.loadAsync(buf)
  const entry = zip.file('manifest.json')
  if (!entry) throw new Error('Archive is missing manifest.json.')
  const raw = await entry.async('string')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('manifest.json is not valid JSON.') }
  const manifest = ManifestSchema.parse(parsed)
  assertSupportedVersion(manifest.version)
  return manifest
}

export async function importArchive(
  ctx: ImportCtx,
  input: { path: string; targetNamespace: string; overwrite: boolean }
): Promise<ImportSummary> {
  const targetNamespace = validateNamespace(input.targetNamespace)
  const buf = await fs.readFile(input.path)
  const zip = await JSZip.loadAsync(buf)

  const manifestEntry = zip.file('manifest.json')
  if (!manifestEntry) throw new Error('Archive is missing manifest.json.')
  const manifest = ManifestSchema.parse(JSON.parse(await manifestEntry.async('string')))
  assertSupportedVersion(manifest.version)

  const summary: ImportSummary = { imported: 0, skipped: 0, overwritten: 0, warnings: [] }

  const cardEntries = Object.keys(zip.files).filter(
    name => name.startsWith('cards/') && name.endsWith('.md') && !zip.files[name]!.dir
  )

  const assetWrittenTo = new Map<string, Set<string>>()
  const usedPaths = new Set<string>()

  for (const entryName of cardEntries) {
    const entry = zip.file(entryName)
    if (!entry) continue
    let rawText: string
    try {
      rawText = await entry.async('string')
    } catch (e) {
      summary.warnings.push(`Failed to read ${entryName}: ${String(e instanceof Error ? e.message : e)}`)
      continue
    }

    let parsed
    try {
      parsed = parseCardFile(rawText)
    } catch (e) {
      summary.warnings.push(`Invalid card in ${entryName}: ${String(e instanceof Error ? e.message : e)}`)
      continue
    }

    const frontmatter = CardFrontmatterSchema.parse(parsed.frontmatter)
    const existing = ctx.index.get(frontmatter.id)

    let destPath: string
    let destNamespace: string
    if (existing) {
      if (!input.overwrite) {
        summary.skipped++
        continue
      }
      destPath = existing.path
      destNamespace = existing.namespace
      summary.overwritten++
    } else {
      destNamespace = targetNamespace
      const dir = path.join(cardsDir(ctx.rootPath), destNamespace)
      await fs.mkdir(dir, { recursive: true })
      const baseName = path.basename(entryName, '.md')
      destPath = await resolveUniquePath(dir, baseName, frontmatter.id, usedPaths)
      summary.imported++
    }
    usedPaths.add(destPath)

    const contents = serializeCardFile(frontmatter, parsed.body)
    await atomicWrite(destPath, contents)
    const full = await readCardAtPath(ctx.rootPath, destPath)
    ctx.watcher.suppressNext(destPath, full.mtime, full.bodyHash)
    const { body: _b, ...meta } = full; void _b
    ctx.index.upsert(meta)
    if (existing && existing.path === destPath) {
      ctx.win.webContents.send('card-changed', full.id)
    } else {
      ctx.win.webContents.send('card-added', full.id)
    }

    const needed = referencedAssets(parsed.body)
    if (needed.length) {
      const alreadyWritten = assetWrittenTo.get(destNamespace) ?? new Set<string>()
      const assetsDir = path.join(path.dirname(destPath), 'assets')
      for (const asset of needed) {
        if (alreadyWritten.has(asset)) continue
        const assetEntry = zip.file(`cards/assets/${asset}`)
        if (!assetEntry) {
          summary.warnings.push(`Asset "${asset}" referenced by ${frontmatter.id} is missing from archive.`)
          continue
        }
        await fs.mkdir(assetsDir, { recursive: true })
        const assetBuf = await assetEntry.async('nodebuffer')
        await fs.writeFile(path.join(assetsDir, asset), assetBuf)
        alreadyWritten.add(asset)
      }
      assetWrittenTo.set(destNamespace, alreadyWritten)
    }

    void hashBody
  }

  return summary
}

export function validateNamespace(ns: string): string {
  const trimmed = ns.trim()
  if (trimmed === '') return ''
  if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
    throw new Error('Namespace must not start or end with "/".')
  }
  const parts = trimmed.split('/')
  for (const part of parts) {
    if (part === '' || part === '.' || part === '..') {
      throw new Error(`Invalid namespace segment: "${part}"`)
    }
    if (part.includes('\\') || part.includes('\0')) {
      throw new Error(`Invalid character in namespace segment: "${part}"`)
    }
  }
  return trimmed
}

async function resolveUniquePath(
  dir: string,
  base: string,
  id: string,
  reserved: Set<string>
): Promise<string> {
  const first = path.join(dir, `${base}.md`)
  if (!reserved.has(first) && !(await exists(first))) return first
  const suffix = id.slice(-6).toLowerCase()
  const withSuffix = path.join(dir, `${base}-${suffix}.md`)
  if (!reserved.has(withSuffix) && !(await exists(withSuffix))) return withSuffix
  return path.join(dir, `${base}-${id.toLowerCase()}.md`)
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true } catch { return false }
}
