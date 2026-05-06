import log from 'electron-log'
import path from 'node:path'

// No electron imports at module top-level — vitest unit tests load this
// indirectly (via window-state.ts) before Electron's `app` exists, and the
// bundled main runs in ESM where `require()` isn't available either.
//
// Pass the userData path in from src/main/index.ts at boot.

let configured = false
let cachedUserData: string | null = null

export function configureLog(userDataPath: string, isPackaged: boolean): void {
  if (configured) return
  configured = true
  cachedUserData = userDataPath
  log.transports.file.resolvePathFn = () => path.join(userDataPath, 'logs', 'main.log')
  log.transports.file.maxSize = 1_048_576
  log.transports.console.level = isPackaged ? false : 'info'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope}{text}'
}

export function logFilePath(): string {
  // Falls back to a sensible default if configureLog hasn't run yet (vitest path).
  return cachedUserData
    ? path.join(cachedUserData, 'logs', 'main.log')
    : path.join(process.cwd(), 'logs', 'main.log')
}

export default log
