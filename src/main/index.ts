import { app, BrowserWindow, protocol, net, session, crashReporter } from 'electron'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { loadConfig } from './store/config'
import { CardIndex } from './store/index'
import { Watcher } from './watcher'
import { registerIpc } from './ipc/register'
import { installAppMenu } from './menu'
import { startAutoUpdater, setupUpdaterIpc } from './updater'
import { restoreWindowState, bindWindowStateSaver } from './window-state'
import { configPath, defaultRootPath } from './paths'
import log, { configureLog } from './log'

app.setName('Mnemo')
configureLog(app.getPath('userData'), app.isPackaged)

// Local-first ethos: capture native crashes to userData/Crashpad/, never upload.
crashReporter.start({ uploadToServer: false, submitURL: '' })

// Single-instance lock — eliminates a vault-corruption hazard on Win/Linux
// where two chokidar watchers + two CardIndex instances would otherwise race.
// macOS already enforces app-singleton behaviour at the OS level; the handler
// is harmless there.
const gotLock = app.requestSingleInstanceLock()
let mainWindow: BrowserWindow | null = null
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  { scheme: 'mnemo-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

const CSP = [
  "default-src 'self' mnemo-asset:",
  // wasm-unsafe-eval is required by Shiki's WebAssembly highlighter; it does NOT
  // re-enable javascript: href execution (which is blocked unless 'unsafe-inline'
  // is present alongside it and Chromium still blocks navigations to javascript:).
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' mnemo-asset: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join('; ')

async function createWindow() {
  // Skip CSP in dev: Vite injects an inline preamble for @vitejs/plugin-react,
  // which `script-src 'self'` blocks, and the renderer fails to mount.
  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      })
    })
  }

  const restore = restoreWindowState()
  const win = new BrowserWindow({
    x: restore.bounds.x,
    y: restore.bounds.y,
    width: restore.bounds.width,
    height: restore.bounds.height,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (restore.maximized) win.maximize()
  if (restore.fullscreen) win.setFullScreen(true)
  bindWindowStateSaver(win)

  const userDataPath = app.getPath('userData')
  let config = await loadConfig(configPath(userDataPath), defaultRootPath(userDataPath))
  const index = new CardIndex()
  // When a fresh install hasn't completed onboarding yet, rootPath is the empty
  // sentinel — skip building the index and starting chokidar; the watcher
  // and index get bootstrapped by completeOnboarding once the app-data vault is created.
  if (config.rootPath) await index.buildFrom(config.rootPath)
  const watcher = new Watcher(config.rootPath, index)
  if (config.rootPath) watcher.start()

  protocol.handle('mnemo-asset', (req) => {
    const url = new URL(req.url)
    const decoded = decodeURIComponent(url.pathname)
    const abs = path.resolve(decoded)
    const root = path.resolve(config.rootPath)
    const rel = path.relative(root, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return new Response('forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(abs).toString())
  })

  const disposeIpc = registerIpc({
    getConfig: () => config,
    setConfig: (c) => { config = c },
    index,
    watcher,
    win
  })

  installAppMenu(win)
  const disposeUpdaterIpc = setupUpdaterIpc(win)
  startAutoUpdater(win, () => config)

  mainWindow = win
  win.on('closed', () => {
    disposeUpdaterIpc()
    disposeIpc()
    if (mainWindow === win) mainWindow = null
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

if (gotLock) app.whenReady().then(createWindow).catch(e => log.error('createWindow failed', e))
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
