import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { launchApp, makeVaultDir, onboardedConfig, SAMPLE_CARD_MD } from './helpers'

test('a card written directly to the vault appears in /browse within 1500 ms', async () => {
  const vault = makeVaultDir()
  mkdirSync(path.join(vault, 'cards'), { recursive: true })
  mkdirSync(path.join(vault, 'state'), { recursive: true })
  writeFileSync(path.join(vault, 'cards', 'cdn.md'), SAMPLE_CARD_MD)

  const { app, cleanup } = await launchApp({ seedConfig: onboardedConfig(vault) })
  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.evaluate(() => { location.hash = '/browse' })
    await expect(win.locator('text=What is a CDN?')).toBeVisible({ timeout: 5000 })

    // External editor writes a brand-new card while the app is running.
    const externalCard = SAMPLE_CARD_MD
      .replace('01HZ0000000000000000000001', '01HZ0000000000000000000003')
      .replace('01HZ0000000000000000000002', '01HZ0000000000000000000004')
      .replace('What is a CDN?', 'What is HTTP/2 multiplexing?')
    writeFileSync(path.join(vault, 'cards', 'http2.md'), externalCard)

    await expect(win.locator('text=What is HTTP/2 multiplexing?')).toBeVisible({ timeout: 1500 })
  } finally {
    await app.close()
    cleanup()
  }
})
