import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_ENTRY = path.resolve(__dirname, '../../dist-electron/main/index.js')

/**
 * Launch the packaged-equivalent Electron build with an isolated `userData`
 * directory so a test can simulate a first-run install or a known-state
 * existing user.
 *
 * `seedConfig` writes a config.json before launch — useful for the
 * window-state and live-edit specs that need to skip onboarding.
 */
export async function launchApp(opts: {
  seedConfig?: object
  seedVault?: { rootPath: string; cards?: Array<{ relPath: string; body: string }> }
} = {}): Promise<{ app: ElectronApplication; userData: string; cleanup: () => void }> {
  const userData = mkdtempSync(path.join(tmpdir(), 'mnemo-e2e-'))
  if (opts.seedConfig) {
    writeFileSync(path.join(userData, 'config.json'), JSON.stringify(opts.seedConfig, null, 2))
  }
  if (opts.seedVault) {
    mkdirSync(path.join(opts.seedVault.rootPath, 'cards'), { recursive: true })
    mkdirSync(path.join(opts.seedVault.rootPath, 'state'), { recursive: true })
    for (const c of opts.seedVault.cards ?? []) {
      const abs = path.join(opts.seedVault.rootPath, 'cards', c.relPath)
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, c.body)
    }
  }
  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userData}`]
  })
  return {
    app,
    userData,
    cleanup: () => rmSync(userData, { recursive: true, force: true })
  }
}

export function makeVaultDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'mnemo-vault-'))
}

const DEFAULT_DASHBOARD = {
  widgets: [
    { id: 'due-forecast', enabled: true, order: 0 },
    { id: 'namespace-ranking', enabled: true, order: 1 },
    { id: 'leech-list', enabled: true, order: 2 },
    { id: 'heatmap', enabled: false, order: 3 },
    { id: 'activity-streak', enabled: false, order: 4 },
    { id: 'key-stats', enabled: false, order: 5 }
  ]
}

export function onboardedConfig(rootPath: string, overrides: Record<string, unknown> = {}) {
  return {
    rootPath,
    theme: 'system',
    dashboard: DEFAULT_DASHBOARD,
    fsrs: { desiredRetention: 0.9, maximumInterval: 365 },
    externalEditor: null,
    onboardedAt: new Date().toISOString(),
    lastRoute: null,
    autoUpdate: { enabled: true },
    ...overrides
  }
}

export const SAMPLE_CARD_MD = `---
id: 01HZ0000000000000000000001
prompts:
  - id: 01HZ0000000000000000000002
    text: "What is a CDN?"
tags: []
created: "2026-01-01T00:00:00.000Z"
---

A geographically-distributed network of cache nodes that serves static assets close to the requesting user.
`
