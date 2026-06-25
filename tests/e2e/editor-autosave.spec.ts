import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { launchApp, makeVaultDir, onboardedConfig, SAMPLE_CARD_MD } from './helpers'

const SAMPLE_CARD_ID = '01HZ0000000000000000000001'

test('editing an existing card body autosaves after the card loads', async () => {
  const vault = makeVaultDir()
  const cardRelPath = 'cdn.md'
  const cardPath = path.join(vault, 'cards', cardRelPath)
  const autosaveText = `Autosave regression ${Date.now()}`

  const { app, cleanup } = await launchApp({
    seedConfig: onboardedConfig(vault),
    seedVault: {
      rootPath: vault,
      cards: [{ relPath: cardRelPath, body: SAMPLE_CARD_MD }]
    }
  })

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.evaluate(cardId => { location.hash = `/editor/${cardId}` }, SAMPLE_CARD_ID)

    const bodyEditor = win.locator('.cm-content').nth(1)
    await expect(bodyEditor).toContainText('geographically-distributed', { timeout: 5000 })

    await bodyEditor.click()
    await win.keyboard.insertText(`\n${autosaveText}`)

    await expect.poll(
      () => readFileSync(cardPath, 'utf8'),
      { timeout: 7000 }
    ).toContain(autosaveText)
  } finally {
    await app.close()
    cleanup()
  }
})
