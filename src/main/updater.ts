import { app } from 'electron'
import type { BrowserWindow } from 'electron'
// electron-updater is a CJS package; under our ESM main bundle the
// default-import + destructure idiom is the only one Node accepts.
import pkg from 'electron-updater'
import log from './log'
import { createIpcScope, VOID } from './ipc/lifecycle'
import type { Config } from '../shared/schema'

const { autoUpdater } = pkg

// We never disable verifyUpdateCodeSignature. Defaults to true; the signed
// .dmg downloaded from a draft GitHub Release will only install if its
// embedded Developer ID matches the one currently installed.
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.logger = log

const STARTUP_DELAY_MS = 30_000
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000

let started = false

export function startAutoUpdater(win: BrowserWindow, getConfig: () => Config): void {
  // Inert in dev — `npm run dev` should never hit GitHub Releases. Same in
  // unpackaged test runs. The `app.isPackaged` flag is the canonical gate.
  if (!app.isPackaged) return
  if (started) return
  started = true

  autoUpdater.on('update-downloaded', (info) => {
    if (win.isDestroyed()) return
    win.webContents.send('update:ready', { version: info?.version ?? 'unknown' })
  })
  autoUpdater.on('error', (err) => log.error('[updater] error', err))

  const tick = async () => {
    try {
      const cfg = getConfig()
      if (cfg.autoUpdate?.enabled === false) {
        log.info('[updater] disabled in config; skipping check')
        return
      }
      log.info('[updater] checkForUpdatesAndNotify')
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (e) {
      log.error('[updater] check failed', e)
    }
  }

  setTimeout(tick, STARTUP_DELAY_MS)
  setInterval(tick, POLL_INTERVAL_MS)
}

// Renderer-driven restart. We do not auto-relaunch silently; the renderer
// chooses the moment via the "Restart now" button in the update banner.
export function setupUpdaterIpc(win: BrowserWindow): () => void {
  void win
  const ipc = createIpcScope()
  ipc.handle('restartToInstall', VOID, async () => {
    if (!app.isPackaged) {
      throw new Error('restartToInstall is a no-op in dev')
    }
    autoUpdater.quitAndInstall()
  })
  return ipc.dispose
}
