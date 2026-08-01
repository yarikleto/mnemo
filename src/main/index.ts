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
import { cardsDir, configPath, defaultRootPath } from './paths'
import type { Config } from '../shared/schema'
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

// Process-scoped state. The vault index, the chokidar watcher and the
// mnemo-asset handler are all singletons for the lifetime of the process — a
// second set would race the first, which is the same hazard the single-instance
// lock guards against. createWindow() may run more than once (macOS `activate`
// after the last window is closed), so bootstrap them exactly once here.
type Vault = { getConfig: () => Config; setConfig: (c: Config) => void; index: CardIndex; watcher: Watcher }
let vaultPromise: Promise<Vault> | null = null

function bootstrapVault(): Promise<Vault> {
  vaultPromise ??= (async () => {
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
      // Pre-onboarding rootPath is the empty sentinel; path.resolve('') would fall
      // back to process.cwd() (often "/" for a Finder-launched app), which turns
      // the containment check below into a no-op and serves any file on disk.
      if (!config.rootPath) return new Response('forbidden', { status: 403 })
      const url = new URL(req.url)
      const decoded = decodeURIComponent(url.pathname)
      const abs = path.resolve(decoded)
      // Assets only ever live beside a card, so scope reads to cards/ rather than
      // the whole vault — state/ and config never need to be reachable this way.
      const root = path.resolve(cardsDir(config.rootPath))
      const rel = path.relative(root, abs)
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return new Response('forbidden', { status: 403 })
      }
      return net.fetch(pathToFileURL(abs).toString())
    })

    return { getConfig: () => config, setConfig: (c: Config) => { config = c }, index, watcher }
  })()
  return vaultPromise
}

let cspInstalled = false

async function createWindow() {
  // Skip CSP in dev: Vite injects an inline preamble for @vitejs/plugin-react,
  // which `script-src 'self'` blocks, and the renderer fails to mount.
  if (!process.env.VITE_DEV_SERVER_URL && !cspInstalled) {
    cspInstalled = true
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      })
    })
  }

  const vault = await bootstrapVault()

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

  const config = () => vault.getConfig()
  const disposeIpc = registerIpc({
    getConfig: config,
    setConfig: vault.setConfig,
    index: vault.index,
    watcher: vault.watcher,
    win
  })

  installAppMenu(win)
  const disposeUpdaterIpc = setupUpdaterIpc(win)
  mainWindow = win
  startAutoUpdater(() => mainWindow, config)

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

// macOS keeps the app alive after its last window closes. Without this the app
// sits in the Dock with no window and no way to get one back.
app.on('activate', () => {
  if (!gotLock) return
  if (BrowserWindow.getAllWindows().length > 0) return
  createWindow().catch(e => log.error('createWindow failed', e))
})
