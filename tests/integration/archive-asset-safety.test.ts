import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import JSZip from 'jszip'
import { importArchive } from '../../src/main/archive/import'
import { referencedAssets } from '../../src/main/archive/export'
import { isSafeAssetName } from '../../src/main/archive/asset-safety'
import { CardIndex } from '../../src/main/store/index'
import { ARCHIVE_VERSION } from '../../src/main/archive/manifest'

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

describe('archive asset safety', () => {
  let dst: string
  let archive: string

  beforeEach(async () => {
    dst = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-dst-'))
    archive = path.join(os.tmpdir(), `mnemo-archive-${Date.now()}.zip`)
  })

  afterEach(async () => {
    await fs.rm(dst, { recursive: true, force: true })
    await fs.rm(archive, { force: true })
  })

  describe('isSafeAssetName', () => {
    it('accepts plain filenames', () => {
      expect(isSafeAssetName('image.png')).toBe(true)
      expect(isSafeAssetName('photo-1.jpg')).toBe(true)
      expect(isSafeAssetName('diagram_v2.svg')).toBe(true)
    })

    it('rejects names with forward slash', () => {
      expect(isSafeAssetName('../../evil.bin')).toBe(false)
      expect(isSafeAssetName('subdir/file.png')).toBe(false)
    })

    it('rejects names with backslash', () => {
      expect(isSafeAssetName('..\\..\\evil.bin')).toBe(false)
      expect(isSafeAssetName('subdir\\file.png')).toBe(false)
    })

    it('rejects names with null byte', () => {
      expect(isSafeAssetName('file\0.png')).toBe(false)
    })

    it('rejects names starting with a dot', () => {
      expect(isSafeAssetName('.hidden')).toBe(false)
      expect(isSafeAssetName('.')).toBe(false)
      expect(isSafeAssetName('..')).toBe(false)
    })
  })

  describe('referencedAssets', () => {
    it('returns the raw asset name including traversal segments (regex unchanged)', () => {
      const body = '![x](./assets/../../evil.bin)'
      const refs = referencedAssets(body)
      // The regex captures whatever is after ./assets/ — the validation is at the use site
      expect(refs).toContain('../../evil.bin')
    })

    it('returns safe names unchanged', () => {
      const body = '![diagram](./assets/diagram.png)'
      expect(referencedAssets(body)).toEqual(['diagram.png'])
    })
  })

  describe('importArchive with malicious asset name', () => {
    it('does not write to the traversal target and records a warning', async () => {
      // Build a minimal valid card body referencing a traversal asset name
      const maliciousName = '../../../../../../tmp/mnemo-evil.bin'
      const cardBody = `![x](./assets/${maliciousName})`

      const cardFrontmatter = [
        '---',
        'id: 01HZZZZZZZZZZZZZZZZZZZZZZA',
        'prompts:',
        '  - id: 01HZZZZZZZZZZZZZZZZZZZZZZ1',
        '    text: "safe question?"',
        'tags: []',
        `created: '2024-01-01T00:00:00.000Z'`,
        '---',
      ].join('\n')
      const cardContent = `${cardFrontmatter}\n${cardBody}\n`

      // Construct the zip with a malicious asset entry whose ZIP path also traverses
      const zip = new JSZip()
      zip.file('manifest.json', JSON.stringify({
        version: ARCHIVE_VERSION,
        exportedAt: new Date().toISOString(),
        cardCount: 1,
        warnings: []
      }))
      zip.file('cards/the-card.md', cardContent)
      // The matching ZIP entry uses the same traversal name
      zip.file(`cards/assets/${maliciousName}`, Buffer.from('MALICIOUS PAYLOAD'))

      const bytes = await zip.generateAsync({ type: 'nodebuffer' })
      await fs.writeFile(archive, bytes)

      // The absolute path the attacker hopes to land the file at
      const traversalTarget = path.resolve('/tmp/mnemo-evil.bin')

      // Clean up any leftover from a previous run
      await fs.rm(traversalTarget, { force: true })

      const dstIndex = new CardIndex()
      await dstIndex.buildFrom(dst)

      const summary = await importArchive(
        makeCtx(dst, dstIndex) as never,
        { path: archive, targetNamespace: 'imported', overwrite: false }
      )

      // The card itself should import fine
      expect(summary.imported).toBe(1)

      // The traversal file must NOT exist
      const targetExists = await fs.access(traversalTarget).then(() => true).catch(() => false)
      expect(targetExists).toBe(false)

      // A warning must be present describing the unsafe name
      const warnMatch = summary.warnings.some(w => w.includes('Skipping unsafe asset name'))
      expect(warnMatch).toBe(true)
    })
  })
})
