import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { launchApp, makeVaultDir, onboardedConfig, SAMPLE_CARD_MD } from './helpers'

test('app launches and a card can be reviewed when the network is gone', async () => {
  const vault = makeVaultDir()
  mkdirSync(path.join(vault, 'cards'), { recursive: true })
  mkdirSync(path.join(vault, 'state'), { recursive: true })
  writeFileSync(path.join(vault, 'cards', 'cdn.md'), SAMPLE_CARD_MD)

  const { app, cleanup } = await launchApp({ seedConfig: onboardedConfig(vault) })
  try {
    // Disable all networking inside the renderer. The app is local-first so
    // /review must keep working; any external fetch (the auto-updater is the
    // canonical one) is allowed to fail silently.
    await app.evaluate(({ session }) => session.defaultSession.enableNetworkEmulation({ offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }))

    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/review')
    await expect(win.locator('h1, [class*="prose-question"]').first()).toContainText('CDN')

    // Reveal + rate Good. The IPCs are local; no network needed.
    await win.keyboard.press(' ')
    await win.locator('button:has-text("Good")').click()
    await expect(win.locator('text=Nothing due right now.')).toBeVisible({ timeout: 3000 })
  } finally {
    await app.close()
    cleanup()
  }
})
