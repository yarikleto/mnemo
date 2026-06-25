import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { parseCardFile, serializeCardFile } from '../markdown/parse'
import { atomicWrite } from '../atomic-write'
import { cardsDir } from '../paths'
import { readCardAtPath } from '../store/cards'
import { ManifestSchema, assertSupportedVersion, type Manifest } from './manifest'
import { CardFrontmatterSchema, validateNamespace } from '../../shared/schema'
import type { CardIndex } from '../store/index'
import type { ImportSummary } from '../../shared/api'
import { referencedAssets, rewriteReferencedAssets } from './export'
import { isSafeArchiveAssetPath, isSafeAssetName } from './asset-safety'

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

  const assetPathsByCardEntry = assetManifestByCardEntry(manifest)
  const reservedAssetPaths = new Set<string>()
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
    if (existing) {
      if (!input.overwrite) {
        summary.skipped++
        continue
      }
      destPath = existing.path
      summary.overwritten++
    } else {
      const dir = path.join(cardsDir(ctx.rootPath), targetNamespace)
      await fs.mkdir(dir, { recursive: true })
      const baseName = path.basename(entryName, '.md')
      destPath = await resolveUniquePath(dir, baseName, frontmatter.id, usedPaths)
      summary.imported++
    }
    usedPaths.add(destPath)

    const assetRenames = new Map<string, string>()
    const needed = referencedAssets(parsed.body)
    if (needed.length) {
      const assetsDir = path.join(path.dirname(destPath), 'assets')
      const manifestAssets = assetPathsByCardEntry.get(entryName)
      for (const asset of needed) {
        if (!isSafeAssetName(asset)) {
          summary.warnings.push(`Skipping unsafe asset name: ${asset}`)
          continue
        }
        const manifestAssetPath = manifestAssets?.get(asset)
        if (manifestAssetPath && !isSafeArchiveAssetPath(manifestAssetPath)) {
          summary.warnings.push(`Skipping unsafe archive asset path: ${manifestAssetPath}`)
          continue
        }
        const archiveAssetPath = manifestAssetPath ?? legacyArchiveAssetPath(manifest, asset)
        if (!archiveAssetPath) {
          summary.warnings.push(`Asset "${asset}" referenced by ${frontmatter.id} is missing from archive.`)
          continue
        }
        const assetEntry = zip.file(archiveAssetPath)
        if (!assetEntry) {
          summary.warnings.push(`Asset "${asset}" referenced by ${frontmatter.id} is missing from archive.`)
          continue
        }
        await fs.mkdir(assetsDir, { recursive: true })
        const assetBuf = await assetEntry.async('nodebuffer')
        const destination = await resolveUniqueAssetPath(assetsDir, asset, frontmatter.id, reservedAssetPaths)
        await fs.writeFile(destination.path, assetBuf)
        reservedAssetPaths.add(destination.path)
        if (destination.name !== asset) assetRenames.set(asset, destination.name)
      }
    }

    const contents = serializeCardFile(frontmatter, rewriteReferencedAssets(parsed.body, assetRenames))
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
  }

  return summary
}

function assetManifestByCardEntry(manifest: Manifest): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>()
  for (const card of manifest.cards ?? []) {
    const assets = new Map<string, string>()
    for (const asset of card.assets) assets.set(asset.name, asset.path)
    out.set(card.path, assets)
  }
  return out
}

function legacyArchiveAssetPath(manifest: Manifest, asset: string): string | null {
  return manifest.cards?.length ? null : `cards/assets/${asset}`
}

async function resolveUniqueAssetPath(
  assetsDir: string,
  preferredName: string,
  id: string,
  reserved: Set<string>
): Promise<{ name: string; path: string }> {
  for (const name of assetNameCandidates(preferredName, id)) {
    const target = path.join(assetsDir, name)
    if (!reserved.has(target) && !(await exists(target))) return { name, path: target }
  }
  throw new Error(`Could not allocate asset name for ${preferredName}`)
}

function* assetNameCandidates(preferredName: string, id: string): Generator<string> {
  yield preferredName
  const ext = path.extname(preferredName)
  const base = path.basename(preferredName, ext)
  const shortId = id.slice(-6).toLowerCase()
  yield `${base}-${shortId}${ext}`
  const fullId = id.toLowerCase()
  yield `${base}-${fullId}${ext}`
  for (let i = 2; ; i++) yield `${base}-${fullId}-${i}${ext}`
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
