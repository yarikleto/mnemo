import { promises as fs } from 'node:fs'
import { dialog, BrowserWindow } from 'electron'
import { buildArchiveZip, finalizeArchive } from './export'
import { readManifest } from './import'
import type { CardIndex } from '../store/index'
import type { ArchivePreview } from '../../shared/api'

export async function exportCardsWithDialog(
  ctx: { rootPath: string; index: CardIndex; win: BrowserWindow },
  ids: string[]
): Promise<{ path: string } | null> {
  const { zip, warnings, cardCount } = await buildArchiveZip(ctx.rootPath, ctx.index, ids)
  const { bytes } = await finalizeArchive(zip, cardCount, warnings)

  const defaultName = `mnemo-export-${new Date().toISOString().slice(0, 10)}.zip`
  const result = await dialog.showSaveDialog(ctx.win, {
    title: 'Export cards',
    defaultPath: defaultName,
    filters: [{ name: 'Mnemo archive', extensions: ['zip'] }]
  })
  if (result.canceled || !result.filePath) return null

  await fs.writeFile(result.filePath, bytes)
  return { path: result.filePath }
}

export async function pickImportFileWithDialog(
  ctx: { win: BrowserWindow }
): Promise<{ path: string; preview: ArchivePreview } | null> {
  const result = await dialog.showOpenDialog(ctx.win, {
    title: 'Import archive',
    properties: ['openFile'],
    filters: [{ name: 'Mnemo archive', extensions: ['zip'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const manifest = await readManifest(filePath)
  return {
    path: filePath,
    preview: {
      version: manifest.version,
      exportedAt: manifest.exportedAt,
      cardCount: manifest.cardCount
    }
  }
}
