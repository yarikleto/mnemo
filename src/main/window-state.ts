import { app, screen, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import log from './log'

// Persisted shape — kept in its own file (window-state.json) so that a
// drag-induced save can never corrupt the more-precious config.json.
export type WindowState = {
  bounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  fullscreen: boolean
  displayId: number
}

export type DesktopGeometry = {
  displays: Array<{ id: number; workArea: { x: number; y: number; width: number; height: number } }>
  primaryId: number
}

export type RestoreResult = {
  bounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  fullscreen: boolean
}

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

export function windowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

// Pure clamp logic — exported for unit tests. Keeps a saved 4K bounds usable
// when the user replays it on a 1080p panel; falls back to the primary display
// when the saved displayId is no longer attached.
export function clampToGeometry(saved: WindowState, geom: DesktopGeometry): RestoreResult {
  const display = geom.displays.find(d => d.id === saved.displayId)
    ?? geom.displays.find(d => d.id === geom.primaryId)
    ?? geom.displays[0]
  if (!display) {
    return {
      bounds: { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      maximized: saved.maximized,
      fullscreen: saved.fullscreen
    }
  }
  const wa = display.workArea
  const width  = Math.min(saved.bounds.width,  wa.width)
  const height = Math.min(saved.bounds.height, wa.height)
  // Keep position only if the saved origin was inside the chosen display's
  // work area; otherwise center the window on the chosen display.
  const insideX = saved.bounds.x >= wa.x && saved.bounds.x + width  <= wa.x + wa.width
  const insideY = saved.bounds.y >= wa.y && saved.bounds.y + height <= wa.y + wa.height
  const x = insideX ? saved.bounds.x : Math.round(wa.x + (wa.width  - width)  / 2)
  const y = insideY ? saved.bounds.y : Math.round(wa.y + (wa.height - height) / 2)
  return { bounds: { x, y, width, height }, maximized: saved.maximized, fullscreen: saved.fullscreen }
}

function defaultRestore(geom?: DesktopGeometry): RestoreResult {
  if (geom) {
    const display = geom.displays.find(d => d.id === geom.primaryId) ?? geom.displays[0]
    if (display) {
      const wa = display.workArea
      return {
        bounds: {
          x: Math.round(wa.x + (wa.width  - DEFAULT_WIDTH)  / 2),
          y: Math.round(wa.y + (wa.height - DEFAULT_HEIGHT) / 2),
          width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT
        },
        maximized: false, fullscreen: false
      }
    }
  }
  return { bounds: { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }, maximized: false, fullscreen: false }
}

export function restoreWindowState(): RestoreResult {
  const geom: DesktopGeometry = {
    displays: screen.getAllDisplays().map(d => ({ id: d.id, workArea: d.workArea })),
    primaryId: screen.getPrimaryDisplay().id
  }
  let raw: string
  try { raw = readFileSync(windowStatePath(), 'utf8') } catch { return defaultRestore(geom) }
  let parsed: WindowState
  try { parsed = JSON.parse(raw) as WindowState } catch { return defaultRestore(geom) }
  if (!parsed?.bounds || typeof parsed.bounds.width !== 'number' || typeof parsed.bounds.height !== 'number') {
    return defaultRestore(geom)
  }
  return clampToGeometry(parsed, geom)
}

export function bindWindowStateSaver(win: BrowserWindow): () => void {
  let timer: NodeJS.Timeout | null = null
  let lastState: WindowState | null = null

  const capture = (): WindowState => {
    // getNormalBounds() preserves the size the user actually picked even when
    // the window is currently maximized or fullscreen — so an un-maximize
    // restores the user's chosen size, not the work-area-sized maximized one.
    const bounds = win.getNormalBounds()
    const display = screen.getDisplayMatching(bounds)
    return {
      bounds,
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
      displayId: display.id
    }
  }

  const flushSync = () => {
    if (!lastState) return
    try {
      writeFileSync(windowStatePath(), JSON.stringify(lastState, null, 2))
    } catch (e) {
      log.warn('[window-state] sync flush failed', e)
    }
  }

  const flushAsync = async () => {
    if (!lastState) return
    try {
      await fs.writeFile(windowStatePath(), JSON.stringify(lastState, null, 2))
    } catch (e) {
      log.warn('[window-state] write failed', e)
    }
  }

  const schedule = () => {
    if (win.isDestroyed()) return
    lastState = capture()
    if (timer) clearTimeout(timer)
    timer = setTimeout(flushAsync, 500)
  }

  win.on('move', schedule)
  win.on('resize', schedule)
  win.on('maximize', schedule)
  win.on('unmaximize', schedule)
  win.on('enter-full-screen', schedule)
  win.on('leave-full-screen', schedule)

  // Synchronous final write — a quit during a drag must not lose the latest
  // position. before-quit fires on every platform's quit path.
  const onBeforeQuit = () => {
    if (timer) { clearTimeout(timer); timer = null }
    flushSync()
  }
  app.on('before-quit', onBeforeQuit)

  return () => {
    if (timer) { clearTimeout(timer); timer = null }
    app.off('before-quit', onBeforeQuit)
  }
}
