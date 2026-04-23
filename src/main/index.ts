import { app, BrowserWindow, protocol, net, session } from 'electron'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { loadConfig } from './store/config'
import { CardIndex } from './store/index'
import { Watcher } from './watcher'
import { registerIpc } from './ipc/register'
import { configPath, defaultRootPath } from './paths'

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
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    })
  })

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  let config = await loadConfig(configPath(), defaultRootPath())
  const index = new CardIndex()
  await index.buildFrom(config.rootPath)
  const watcher = new Watcher(config.rootPath, index)
  watcher.start()

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

  registerIpc({
    getConfig: () => config,
    setConfig: (c) => { config = c },
    index,
    watcher,
    win
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
