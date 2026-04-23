import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import JSZip from 'jszip'
import { createCardOnDisk } from '../../src/main/store/cards'
import { CardIndex } from '../../src/main/store/index'
import { buildArchiveZip } from '../../src/main/archive/export'
import { importArchive, readManifest } from '../../src/main/archive/import'
import { ARCHIVE_VERSION, type Manifest } from '../../src/main/archive/manifest'

type StubCtx = {
  rootPath: string
  index: CardIndex
  watcher: { suppressNext: (...args: unknown[]) => void }
  win: { webContents: { send: (...args: unknown[]) => void } }
}

function makeCtx(root: string, index: CardIndex): StubCtx {
  return {
    rootPath: root,
    index,
    watcher: { suppressNext: vi.fn() },
    win: { webContents: { send: vi.fn() } }
  }
}

async function writeZip(zip: JSZip, targetPath: string, manifest: Manifest) {
  zip.file('manifest.json', JSON.stringify(manifest))
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.writeFile(targetPath, bytes)
}

describe('archive round-trip', () => {
  let src: string
  let dst: string
  let archive: string

  beforeEach(async () => {
    src = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-src-'))
    dst = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-dst-'))
    archive = path.join(os.tmpdir(), `mnemo-archive-${Date.now()}.zip`)
  })

  afterEach(async () => {
    await fs.rm(src, { recursive: true, force: true })
    await fs.rm(dst, { recursive: true, force: true })
    await fs.rm(archive, { force: true })
  })

  it('exports then imports preserving card content and IDs', async () => {
    const a = await createCardOnDisk(src, { namespace: 'lang/es', prompts: ['hola?'], body: 'hi' })
    const b = await createCardOnDisk(src, { namespace: 'lang/fr', prompts: ['bonjour?'], body: 'hello' })

    const srcIndex = new CardIndex()
    await srcIndex.buildFrom(src)

    const { zip, cardCount, warnings } = await buildArchiveZip(src, srcIndex, [a.id, b.id])
    expect(cardCount).toBe(2)
    expect(warnings).toEqual([])

    await writeZip(zip, archive, {
      version: ARCHIVE_VERSION,
      exportedAt: new Date().toISOString(),
      cardCount,
      warnings
    })

    const manifest = await readManifest(archive)
    expect(manifest.version).toBe(ARCHIVE_VERSION)
    expect(manifest.cardCount).toBe(2)

    const dstIndex = new CardIndex()
    await dstIndex.buildFrom(dst)

    const summary = await importArchive(
      makeCtx(dst, dstIndex) as never,
      { path: archive, targetNamespace: 'imported', overwrite: false }
    )
    expect(summary.imported).toBe(2)
    expect(summary.skipped).toBe(0)
    expect(summary.overwritten).toBe(0)

    const dstAfter = new CardIndex()
    await dstAfter.buildFrom(dst)
    const ids = new Set(dstAfter.allIds())
    expect(ids.has(a.id)).toBe(true)
    expect(ids.has(b.id)).toBe(true)

    const imported = dstAfter.all().find(c => c.id === a.id)!
    expect(imported.namespace).toBe('imported')
    expect(imported.prompts[0]!.text).toBe('hola?')
  })

  it('skips existing IDs when overwrite=false', async () => {
    const a = await createCardOnDisk(src, { namespace: 'x', prompts: ['q?'], body: 'orig' })
    const srcIndex = new CardIndex()
    await srcIndex.buildFrom(src)
    const { zip, cardCount, warnings } = await buildArchiveZip(src, srcIndex, [a.id])
    await writeZip(zip, archive, {
      version: ARCHIVE_VERSION,
      exportedAt: new Date().toISOString(),
      cardCount,
      warnings
    })

    await createCardOnDisk(dst, { namespace: 'x', prompts: ['q?'], body: 'orig' })
    const dstIndex = new CardIndex()
    await dstIndex.buildFrom(dst)
    // Force the same id to exist in dst to test skip path.
    const existing = dstIndex.all()[0]!
    const withMatchingId = { ...existing, id: a.id }
    dstIndex.removeById(existing.id)
    dstIndex.upsert(withMatchingId)
    // Rename the on-disk file so that it is addressable by a.id too (content kept, id in frontmatter still different,
    // but the index above is what importArchive consults).

    const summary = await importArchive(
      makeCtx(dst, dstIndex) as never,
      { path: archive, targetNamespace: 'whatever', overwrite: false }
    )
    expect(summary.imported).toBe(0)
    expect(summary.skipped).toBe(1)
    expect(summary.overwritten).toBe(0)
  })

  it('overwrites existing cards in-place when overwrite=true', async () => {
    // Create a card in src with a specific id captured for reuse
    const a = await createCardOnDisk(src, { namespace: 'src', prompts: ['v2?'], body: 'updated' })
    const srcIndex = new CardIndex()
    await srcIndex.buildFrom(src)
    const { zip, cardCount, warnings } = await buildArchiveZip(src, srcIndex, [a.id])
    await writeZip(zip, archive, {
      version: ARCHIVE_VERSION,
      exportedAt: new Date().toISOString(),
      cardCount,
      warnings
    })

    // Seed dst by copying the src card file into a different namespace (same id on disk, older body)
    const destNs = path.join(dst, 'cards', 'kept')
    await fs.mkdir(destNs, { recursive: true })
    const destFile = path.join(destNs, path.basename(a.path))
    const originalRaw = await fs.readFile(a.path, 'utf8')
    await fs.writeFile(destFile, originalRaw.replace('updated', 'original'))
    const dstIndex = new CardIndex()
    await dstIndex.buildFrom(dst)

    const summary = await importArchive(
      makeCtx(dst, dstIndex) as never,
      { path: archive, targetNamespace: 'ignored', overwrite: true }
    )
    expect(summary.overwritten).toBe(1)
    expect(summary.imported).toBe(0)

    const after = new CardIndex()
    await after.buildFrom(dst)
    const card = after.get(a.id)!
    expect(card.namespace).toBe('kept')
    const raw = await fs.readFile(card.path, 'utf8')
    expect(raw).toContain('updated')
    expect(raw).not.toContain('original')
  })

  it('rejects unsupported versions on preview', async () => {
    const zip = new JSZip()
    await writeZip(zip, archive, {
      version: ARCHIVE_VERSION + 1,
      exportedAt: new Date().toISOString(),
      cardCount: 0,
      warnings: []
    })
    await expect(readManifest(archive)).rejects.toThrow(/newer/)
  })

  it('rejects archives missing manifest.json', async () => {
    const zip = new JSZip()
    zip.file('cards/x.md', 'nope')
    const bytes = await zip.generateAsync({ type: 'nodebuffer' })
    await fs.writeFile(archive, bytes)
    await expect(readManifest(archive)).rejects.toThrow(/manifest/)
  })
})
