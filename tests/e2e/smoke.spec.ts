import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'

test('boots, creates a card, reviews it', async () => {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist-electron/main/index.js')]
  })
  const window = await app.firstWindow()
  await window.waitForSelector('text=Interview Prep')

  await window.click('text=+ New card')
  await window.fill('input[placeholder="Question…"]', 'What is a CDN?')
  await window.fill('input[placeholder^="namespace"]', 'networking')
  await window.click('text=Save')
  await window.waitForSelector('text=Saved')

  await window.click('text=Review')
  await expect(window.locator('h1')).toContainText('CDN')
  await window.keyboard.press('Space')
  await window.keyboard.press('3')
  await expect(window.locator('text=No cards due.')).toBeVisible()

  await app.close()
})
