// Boot Mnemo via Playwright _electron, drive each screen, capture screenshots
// in both themes. Designed for the polish-pass design review.
//
// Usage: node .claude/reviews/capture.mjs

import { _electron as electron } from '@playwright/test'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SHOTS = path.join(ROOT, '.claude', 'reviews', 'screenshots')
const MAIN = path.join(ROOT, 'dist-electron', 'main', 'index.js')
const SEED = path.join(ROOT, '.claude', 'reviews', 'seed.mjs')

const VAULT = path.join(os.tmpdir(), 'mnemo-design-review-vault')
const USER_DATA = path.join(os.tmpdir(), 'mnemo-design-review-userdata')

function runSeed(theme) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SEED, VAULT, USER_DATA, theme], { stdio: 'inherit' })
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`seed exit ${code}`)))
  })
}

async function shot(window, theme, name) {
  const dir = path.join(SHOTS, theme)
  await fs.mkdir(dir, { recursive: true })
  const out = path.join(dir, `${name}.png`)
  await window.screenshot({ path: out })
  console.log(`  → ${theme}/${name}.png`)
}

async function captureForTheme(theme) {
  console.log(`\n=== Theme: ${theme} ===`)
  await runSeed(theme)

  const app = await electron.launch({
    args: [MAIN, `--user-data-dir=${USER_DATA}`],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  })

  // Force the window to a sane review size — main/index.ts launches fullscreen.
  await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows()
    for (const w of wins) {
      try { w.setFullScreen(false) } catch {}
      try { w.setSize(1440, 900, false) } catch {}
      try { w.center() } catch {}
    }
  })

  const window = await app.firstWindow({ timeout: 15000 })
  await window.waitForLoadState('domcontentloaded')

  // wait until config is loaded and sidebar renders
  await window.waitForSelector('text=Mnemo', { timeout: 10000 })
  await window.waitForTimeout(800)

  // 1. /review with answer hidden (default landing)
  await window.evaluate(() => location.hash = '#/review')
  await window.waitForTimeout(500)
  await shot(window, theme, '01-review-hidden')

  // 2. /review with answer revealed
  await window.keyboard.press('Space')
  await window.waitForTimeout(400)
  await shot(window, theme, '02-review-revealed')

  // 3. /review empty (rate the queue empty by pressing 4-Easy four times)
  // Skip — we want to keep cards due for other shots; instead, simulate empty
  // by filtering namespaces that have nothing.

  // 4. /browse
  await window.evaluate(() => location.hash = '#/browse')
  await window.waitForTimeout(700)
  await shot(window, theme, '03-browse')

  // 5. /dashboard
  await window.evaluate(() => location.hash = '#/dashboard')
  await window.waitForTimeout(900)
  await shot(window, theme, '04-dashboard')

  // 6. /card/:id — first browsed card
  const firstCardId = await window.evaluate(async () => {
    const r = await window.api.listCards({ search: '', tags: [], namespaces: [] })
    return r.ok ? r.data[0]?.id : null
  })
  if (firstCardId) {
    await window.evaluate(id => location.hash = `#/card/${id}`, firstCardId)
    await window.waitForTimeout(700)
    await shot(window, theme, '05-card-view')
  }

  // 7. /editor/:id — edit the same card
  if (firstCardId) {
    await window.evaluate(id => location.hash = `#/editor/${id}`, firstCardId)
    await window.waitForTimeout(700)
    await shot(window, theme, '06-editor-edit')
  }

  // 8. /editor/new
  await window.evaluate(() => location.hash = '#/editor/new')
  await window.waitForTimeout(700)
  await shot(window, theme, '07-editor-new')

  // 9. /settings
  await window.evaluate(() => location.hash = '#/settings')
  await window.waitForTimeout(700)
  await shot(window, theme, '08-settings')

  // 10. Sidebar: namespaces are always visible. Take a focused shot of the chrome with the sidebar visible.
  // (already in every shot, but capture an explicit one with browse so the deck tree is visible)
  await window.evaluate(() => location.hash = '#/browse')
  await window.waitForTimeout(400)
  await shot(window, theme, '09-sidebar-with-tree')

  // 11. Export dialog
  await window.click('button[title="Export cards to archive"]', { timeout: 4000 }).catch(() => {})
  await window.waitForTimeout(700)
  await shot(window, theme, '10-export-dialog')
  // close
  await window.keyboard.press('Escape').catch(() => {})
  await window.waitForTimeout(300)

  // 12. Import dialog (open dialog only — no file picked, but we get the empty state of the dialog)
  await window.click('button[title="Import cards from archive"]', { timeout: 4000 }).catch(() => {})
  await window.waitForTimeout(700)
  await shot(window, theme, '11-import-dialog')
  await window.keyboard.press('Escape').catch(() => {})
  await window.waitForTimeout(300)

  // 13. /review empty — bring up review with a namespace filter that has no due cards
  // we simulate "nothing due" by clicking through all due cards
  await window.evaluate(() => location.hash = '#/review')
  await window.waitForTimeout(500)
  // press space + 3 (Good) repeatedly to drain the due queue
  for (let i = 0; i < 6; i++) {
    await window.keyboard.press('Space').catch(() => {})
    await window.waitForTimeout(150)
    await window.keyboard.press('3').catch(() => {})
    await window.waitForTimeout(250)
  }
  await window.waitForTimeout(600)
  await shot(window, theme, '12-review-empty')

  // 14. /browse search empty — filter to an impossible string to force the empty state
  await window.evaluate(() => location.hash = '#/browse')
  await window.waitForTimeout(400)
  const searchBox = await window.$('input[placeholder*="earch" i], input[type="search"]').catch(() => null)
  if (searchBox) {
    await searchBox.fill('zzz_no_match_xyzzy_qwer')
    await window.waitForTimeout(400)
    await shot(window, theme, '13-browse-empty-search')
  }

  await app.close()
}

await captureForTheme('light')
await captureForTheme('dark')
console.log(`\nAll screenshots → ${SHOTS}`)
