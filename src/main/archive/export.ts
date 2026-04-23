import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { readCardAtPath } from '../store/cards'
import { cardsDir } from '../paths'
import { ARCHIVE_VERSION, type Manifest } from './manifest'
import type { CardIndex } from '../store/index'
import { promptPreview } from '../../shared/prompt'

export async function buildArchiveZip(
  rootPath: string,
  index: CardIndex,
  ids: string[]
): Promise<{ zip: JSZip; warnings: string[]; cardCount: number }> {
  const zip = new JSZip()
  const warnings: string[] = []
  const usedFilenames = new Set<string>()
  const includedAssets = new Set<string>()
  let cardCount = 0

  for (const id of ids) {
    const meta = index.get(id)
    if (!meta) {
      warnings.push(`Card ${id} is no longer available.`)
      continue
    }
    let full
    try {
      full = await readCardAtPath(rootPath, meta.path)
    } catch (e) {
      warnings.push(`Failed to read card ${id}: ${String(e instanceof Error ? e.message : e)}`)
      continue
    }
    const slug = slugForCard(full.prompts[0]?.text ?? full.id, full.id)
    const filename = uniqueName(usedFilenames, slug, full.id)
    usedFilenames.add(filename)

    const raw = await fs.readFile(meta.path, 'utf8')
    zip.file(`cards/${filename}`, raw)
    cardCount++

    for (const asset of referencedAssets(full.body)) {
      if (includedAssets.has(asset)) continue
      const assetAbs = path.join(path.dirname(meta.path), 'assets', asset)
      try {
        const buf = await fs.readFile(assetAbs)
        zip.file(`cards/assets/${asset}`, buf)
        includedAssets.add(asset)
      } catch {
        warnings.push(`Asset "${asset}" referenced by card ${id} is missing on disk.`)
      }
    }
  }

  void cardsDir
  return { zip, warnings, cardCount }
}

export async function finalizeArchive(
  zip: JSZip,
  cardCount: number,
  warnings: string[]
): Promise<{ zip: JSZip; manifest: Manifest; bytes: Buffer }> {
  const manifest: Manifest = {
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    cardCount,
    warnings
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return { zip, manifest, bytes }
}

function slugForCard(promptText: string, id: string): string {
  const preview = promptPreview(promptText, 80)
  const s = preview.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || id.toLowerCase()
}

function uniqueName(used: Set<string>, base: string, id: string): string {
  const first = `${base}.md`
  if (!used.has(first)) return first
  const suffix = id.slice(-6).toLowerCase()
  const withSuffix = `${base}-${suffix}.md`
  if (!used.has(withSuffix)) return withSuffix
  return `${base}-${id.toLowerCase()}.md`
}

const ASSET_RE = /(?:!\[[^\]]*\]\(|src=["'])\.\/assets\/([^)\s"']+)/g

export function referencedAssets(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(ASSET_RE)) {
    if (m[1]) out.add(m[1])
  }
  return [...out]
}
