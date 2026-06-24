import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { launchApp, makeVaultDir, onboardedConfig } from './helpers'

declare global {
  var mnemoOpenedVaultPath: string | null
  var mnemoOpenDialogCalls: number
}

test('fresh userData routes to /onboarding and starts with the app-data vault', async () => {
  const { app, userData, cleanup } = await launchApp()
  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/onboarding')
    await expect(win.locator('h1')).toContainText('Welcome to Mnemo.')

    // Read the default-vault path off the button subtitle so we can assert
    // its cards/ + state/ subdirs were created after we click through.
    const subtitle = await win.locator('button:has-text("Start using Mnemo") .font-mono').textContent()
    expect(subtitle).toBeTruthy()
    expect(subtitle).toBe(path.join(realpathSync(userData), 'vault'))
    expect(path.basename(subtitle!)).toBe('vault')
    await expect(win.locator('button:has-text("Choose a folder")')).toHaveCount(0)

    await win.click('button:has-text("Start using Mnemo")')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/review')
    await expect(win.locator('aside')).toBeVisible()

    if (subtitle) {
      expect(existsSync(path.join(subtitle, 'cards'))).toBe(true)
      expect(existsSync(path.join(subtitle, 'state'))).toBe(true)
    }
  } finally {
    await app.close()
    cleanup()
  }
})

test('Open Vault Folder menu command opens the current vault without changing rootPath', async () => {
  const vault = makeVaultDir()
  const otherVault = makeVaultDir()
  const { app, userData, cleanup } = await launchApp({
    seedConfig: onboardedConfig(vault),
    seedVault: { rootPath: vault }
  })
  try {
    await app.evaluate(({ shell, dialog }, pickedPath) => {
      globalThis.mnemoOpenedVaultPath = null
      globalThis.mnemoOpenDialogCalls = 0
      shell.openPath = async (target: string) => {
        globalThis.mnemoOpenedVaultPath = target
        return ''
      }
      dialog.showOpenDialog = async () => {
        globalThis.mnemoOpenDialogCalls += 1
        return { canceled: false, filePaths: [pickedPath] }
      }
    }, otherVault)

    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/review')

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('menu:open-vault-folder')
    })

    await expect.poll(() => app.evaluate(() => globalThis.mnemoOpenedVaultPath)).toBe(vault)
    await expect.poll(() => app.evaluate(() => globalThis.mnemoOpenDialogCalls)).toBe(0)

    const disk = JSON.parse(readFileSync(path.join(userData, 'config.json'), 'utf8'))
    expect(disk.rootPath).toBe(vault)
    expect(disk.rootPath).not.toBe(otherVault)

    const blocked = await win.evaluate((target) => window.api.updateConfig({ rootPath: target }), otherVault)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toContain('managed by Mnemo')

    const afterBlocked = JSON.parse(readFileSync(path.join(userData, 'config.json'), 'utf8'))
    expect(afterBlocked.rootPath).toBe(vault)

    await win.evaluate(() => { location.hash = '#/settings' })
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/settings')
    await expect(win.locator('button:has-text("Change vault")')).toHaveCount(0)
  } finally {
    await app.close()
    cleanup()
  }
})
