import { test, expect } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchApp, makeVaultDir, onboardedConfig } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_ENTRY = path.resolve(__dirname, '../../dist-electron/main/index.js')

test('window-state.json restores bounds across launches', async () => {
  const vault = makeVaultDir()
  const { app, userData, cleanup } = await launchApp({ seedConfig: onboardedConfig(vault) })
  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      w?.setBounds({ x: 120, y: 140, width: 900, height: 700 })
    })
    // Allow the debounced saver (500 ms) to flush.
    await win.waitForTimeout(900)
    await app.close()

    // Relaunch using the same userData — bounds should round-trip.
    const app2 = await electron.launch({ args: [MAIN_ENTRY, `--user-data-dir=${userData}`] })
    const win2 = await app2.firstWindow()
    await win2.waitForLoadState('domcontentloaded')
    const bounds = await app2.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      return w?.getBounds() ?? null
    })
    expect(bounds).toEqual({ x: 120, y: 140, width: 900, height: 700 })
    await app2.close()
  } finally {
    cleanup()
  }
})

test('lastRoute restore: navigating to /dashboard, quitting, relaunching lands on /dashboard', async () => {
  const vault = makeVaultDir()
  const { app, userData, cleanup } = await launchApp({ seedConfig: onboardedConfig(vault) })
  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/review')
    await win.evaluate(() => { location.hash = '#/dashboard' })
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/dashboard')
    await expect.poll(() => {
      const cfg = JSON.parse(readFileSync(path.join(userData, 'config.json'), 'utf8'))
      return cfg.lastRoute
    }).toBe('/dashboard')
    await app.close()

    const app2 = await electron.launch({ args: [MAIN_ENTRY, `--user-data-dir=${userData}`] })
    const win2 = await app2.firstWindow()
    await win2.waitForLoadState('domcontentloaded')
    await expect.poll(() => win2.evaluate(() => location.hash)).toBe('#/dashboard')
    await app2.close()
  } finally {
    cleanup()
  }
})
