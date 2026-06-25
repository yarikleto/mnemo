import { describe, it, expect, beforeEach, vi } from 'vitest'

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
  const autoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    logger: null as unknown,
    on: vi.fn(),
    checkForUpdatesAndNotify: vi.fn(),
    quitAndInstall: vi.fn()
  }
  return {
    handlers,
    ipcMain,
    app: { isPackaged: false },
    autoUpdater
  }
})

vi.mock('electron', () => ({
  app: electronMock.app,
  ipcMain: electronMock.ipcMain,
  BrowserWindow: class {}
}))

vi.mock('electron-updater', () => ({
  default: { autoUpdater: electronMock.autoUpdater }
}))

import { setupUpdaterIpc } from '../../src/main/updater'

describe('updater restart IPC', () => {
  beforeEach(() => {
    electronMock.handlers.clear()
    electronMock.ipcMain.handle.mockClear()
    electronMock.ipcMain.removeHandler.mockClear()
    electronMock.autoUpdater.quitAndInstall.mockClear()
    electronMock.app.isPackaged = false
  })

  it('returns an ApiResult error in dev', async () => {
    const dispose = setupUpdaterIpc({} as Parameters<typeof setupUpdaterIpc>[0])

    try {
      const result = await electronMock.handlers.get('restartToInstall')!(null, null)

      expect(result).toEqual({ ok: false, error: 'restartToInstall is a no-op in dev' })
      expect(electronMock.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('validates void input before restarting', async () => {
    electronMock.app.isPackaged = true
    const dispose = setupUpdaterIpc({} as Parameters<typeof setupUpdaterIpc>[0])

    try {
      const result = await electronMock.handlers.get('restartToInstall')!(null, { unexpected: true })

      expect(result).toMatchObject({ ok: false })
      expect(electronMock.autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('calls quitAndInstall in packaged builds', async () => {
    electronMock.app.isPackaged = true
    const dispose = setupUpdaterIpc({} as Parameters<typeof setupUpdaterIpc>[0])

    try {
      const result = await electronMock.handlers.get('restartToInstall')!(null, null)

      expect(result).toEqual({ ok: true, data: undefined })
      expect(electronMock.autoUpdater.quitAndInstall).toHaveBeenCalledOnce()
    } finally {
      dispose()
    }
  })
})
