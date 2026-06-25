import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>()
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
      handlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    })
  }
  return {
    handlers,
    ipcMain,
    app: { getPath: vi.fn(() => '/tmp/mnemo-test-user-data') },
    shell: { openPath: vi.fn() }
  }
})

vi.mock('electron', () => ({
  app: electronMock.app,
  shell: electronMock.shell,
  ipcMain: electronMock.ipcMain,
  BrowserWindow: class {}
}))

import { registerIpc } from '../../src/main/ipc/register'
import { createCardOnDisk, walkCardFiles } from '../../src/main/store/cards'
import { CardIndex } from '../../src/main/store/index'
import { cardsDir } from '../../src/main/paths'
import { DEFAULT_CONFIG, type Config } from '../../src/shared/schema'

describe('deleteNamespace IPC', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'mnemo-delete-ns-'))
    electronMock.handlers.clear()
    electronMock.ipcMain.handle.mockClear()
    electronMock.ipcMain.removeHandler.mockClear()
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('rejects whitespace-only namespace without deleting the cards root', async () => {
    await createCardOnDisk(root, { namespace: '', prompts: ['Root card?'], body: 'Root body' })
    await createCardOnDisk(root, { namespace: 'deck', prompts: ['Deck card?'], body: 'Deck body' })
    const index = await buildIndex(root)
    const dispose = registerIpc(makeCtx(root, index))

    try {
      const result = await electronMock.handlers.get('deleteNamespace')!(null, '   ')

      expect(result).toMatchObject({ ok: false, error: 'Namespace is required' })
      await expect(fs.access(cardsDir(root))).resolves.toBeUndefined()
      await expect(walkCardFiles(root)).resolves.toHaveLength(2)
      expect(index.all()).toHaveLength(2)
    } finally {
      dispose()
    }
  })

  it('trims namespace before deleting the target deck', async () => {
    await createCardOnDisk(root, { namespace: '', prompts: ['Root card?'], body: 'Root body' })
    await createCardOnDisk(root, { namespace: 'deck', prompts: ['Deck card?'], body: 'Deck body' })
    const index = await buildIndex(root)
    const dispose = registerIpc(makeCtx(root, index))

    try {
      const result = await electronMock.handlers.get('deleteNamespace')!(null, ' deck ')

      expect(result).toEqual({ ok: true, data: { deleted: 1 } })
      await expect(walkCardFiles(root)).resolves.toHaveLength(1)
      expect(index.all().map(card => card.namespace)).toEqual([''])
    } finally {
      dispose()
    }
  })
})

async function buildIndex(root: string): Promise<CardIndex> {
  const index = new CardIndex()
  await index.buildFrom(root)
  return index
}

function makeCtx(root: string, index: CardIndex): Parameters<typeof registerIpc>[0] {
  const config: Config = { rootPath: root, ...DEFAULT_CONFIG }
  const watcher = {
    on: vi.fn(),
    off: vi.fn(),
    suppressNext: vi.fn(),
    relocate: vi.fn()
  }
  const win = { webContents: { send: vi.fn() } }

  return {
    getConfig: () => config,
    setConfig: vi.fn(),
    index,
    watcher,
    win
  } as unknown as Parameters<typeof registerIpc>[0]
}
