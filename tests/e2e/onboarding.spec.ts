import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { launchApp } from './helpers'

test('fresh userData routes to /onboarding and "Use the default" lands on /review', async () => {
  const { app, cleanup } = await launchApp()
  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await expect.poll(() => win.evaluate(() => location.hash)).toBe('#/onboarding')
    await expect(win.locator('h1')).toContainText('Welcome to Mnemo.')

    // Read the default-vault path off the button subtitle so we can assert
    // its cards/ + state/ subdirs were created after we click through.
    const subtitle = await win.locator('button:has-text("Use the default") .font-mono').textContent()
    expect(subtitle).toBeTruthy()

    await win.click('button:has-text("Use the default")')
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
