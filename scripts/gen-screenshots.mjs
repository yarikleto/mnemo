#!/usr/bin/env node
// Regenerates README screenshots. Seeds a disposable demo vault, drives the Electron
// app through a few routes, captures raw screenshots, then rewraps each with rounded
// corners and a soft drop shadow via a secondary chromium page.
//
// Usage:  npm run build && node scripts/gen-screenshots.mjs
//
// Safe: the user's config at ~/Library/Application Support/mnemo/config.json is backed
// up and restored (try/finally). The demo vault is wiped at the end.

import { _electron as electron, chromium } from '@playwright/test'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import url from 'node:url'

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const MAIN = path.join(ROOT, 'dist-electron/main/index.js')
const OUT_DIR = path.join(ROOT, 'assets/screenshots')
const TMP_VAULT = path.join(os.tmpdir(), 'mnemo-demo-screens')
// Playwright's _electron.launch doesn't apply the package.json "name" to userData,
// so the launched app reads config from the Electron default (.../Electron/config.json),
// not the packaged app's (.../mnemo/config.json). We swap the one the launched app will
// actually read and restore it in finally.
const CONFIG_PATH = path.join(os.homedir(), 'Library/Application Support/Electron/config.json')
const BACKUP = CONFIG_PATH + '.backup-' + Date.now()

const VIEWPORT = { width: 1440, height: 900 }
const WRAP_MARGIN = 60
const WRAP_RADIUS = 14

const DEMO_CARDS = [
  {
    namespace: 'languages/japanese',
    prompts: [
      'What does **常識** (jōshiki) mean?',
      'Give a sentence using 常識.'
    ],
    body: '*Common sense*; what "everybody knows".\n\n- **常識がない** — lacks common sense\n- **一般常識** — general knowledge\n\n> 常識的に考えて、それは無理だ。\n\nFrom 常 (constant) + 識 (knowledge).',
    tags: ['vocab', 'N3']
  },
  {
    namespace: 'algorithms/graphs',
    prompts: ['When does Dijkstra fail, and what do you use instead?'],
    body: `Dijkstra assumes **non-negative edge weights**. With negatives, the greedy invariant breaks.

| Situation | Algorithm |
|---|---|
| Non-negative weights | Dijkstra — \`O((V+E) log V)\` |
| Negative weights, no negative cycles | Bellman–Ford — \`O(VE)\` |
| All-pairs shortest paths | Floyd–Warshall — \`O(V³)\` |

\`\`\`python
def bellman_ford(graph, src):
    dist = {v: float('inf') for v in graph}
    dist[src] = 0
    for _ in range(len(graph) - 1):
        for u, v, w in graph.edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    return dist
\`\`\``,
    tags: ['graphs', 'shortest-path']
  },
  {
    namespace: 'algorithms/graphs',
    prompts: ['Explain topological sort with an example.'],
    body: 'Linear ordering of a DAG such that every edge u→v has u before v.\n\n**Uses**: build systems, task scheduling, course prerequisites.\n\nKahn\'s algorithm maintains a queue of zero-indegree nodes.',
    tags: ['graphs', 'dag']
  },
  {
    namespace: 'system-design/caching',
    prompts: ['What is cache stampede and how do you mitigate it?'],
    body: 'A **cache stampede** is when many requests miss a hot key simultaneously and all hit the backend.\n\n**Mitigations:**\n- Request coalescing (singleflight)\n- Probabilistic early expiration\n- Lock-and-regenerate on miss\n\nXFetch keeps latency p99 bounded even under heavy traffic.',
    tags: ['caching', 'reliability']
  },
  {
    namespace: 'system-design/caching',
    prompts: ['LRU vs LFU — when would you pick each?'],
    body: '**LRU** — recency matters most. Access patterns are temporal.\n\n**LFU** — popularity matters most. Some items are hot forever.\n\nReal systems often blend: ARC, W-TinyLFU.',
    tags: ['caching']
  },
  {
    namespace: 'medicine/anatomy',
    prompts: ['Label the four chambers of the heart.'],
    body: '- **Right atrium** → receives deoxygenated blood from vena cavae\n- **Right ventricle** → pumps to lungs via pulmonary artery\n- **Left atrium** → receives oxygenated blood from pulmonary veins\n- **Left ventricle** → pumps to body via aorta (thickest wall)',
    tags: ['cardio']
  },
  {
    namespace: 'languages/japanese',
    prompts: ['Particle: when to use **は** vs **が**?'],
    body: '**は** marks the *topic* — "as for X, ...". Introduces known info.\n\n**が** marks the *subject* — new info, emphasis, or with question words.\n\n> 誰が来た？ (*who* came?) — が required\n> 私は学生です (as for me, student)',
    tags: ['grammar', 'particles']
  }
]

async function writeDemoState(vault) {
  // Pre-populate state for a few cards so dashboard widgets have interesting data.
  const stateDir = path.join(vault, 'state')
  await fs.mkdir(stateDir, { recursive: true })
  // Intentionally left empty — the app creates state on first rate.
}

async function seed(appWin) {
  for (const c of DEMO_CARDS) {
    const res = await appWin.evaluate(async (card) => window.api.createCard(card), c)
    if (!res.ok) throw new Error('seed createCard failed: ' + res.error)
  }
  // Rate a subset so dashboard has history; leave the rest due for the review screen.
  const due = await appWin.evaluate(async () => window.api.getDueQueue({ namespaces: [] }))
  if (!due.ok) throw new Error('seed queue failed')
  console.log('[seed] due after create:', due.data.length)
  const ratings = ['Good', 'Hard', 'Easy']
  for (let i = 0; i < Math.min(ratings.length, due.data.length); i++) {
    const entry = due.data[i]
    await appWin.evaluate(
      async ({ id, r }) => window.api.rateReview({ cardId: id, rating: r }),
      { id: entry.cardId, r: ratings[i] }
    )
  }
  const after = await appWin.evaluate(async () => window.api.getDueQueue({ namespaces: [] }))
  console.log('[seed] due after rating:', after.ok ? after.data.length : 'err')
}

async function captureRoute(appWin, route, filename, opts = {}) {
  // Full reload forces the SPA to re-fetch queue/cards picked up after initial mount.
  await appWin.evaluate((h) => { location.hash = h; location.reload() }, route)
  await appWin.waitForLoadState('domcontentloaded')
  await appWin.waitForSelector('a[href*="/review"]', { timeout: 6000 })
  await appWin.waitForTimeout(opts.waitMs ?? 800)
  if (opts.waitFor) {
    try { await appWin.waitForSelector(opts.waitFor, { timeout: 6000 }) }
    catch (e) {
      await appWin.screenshot({ path: `/tmp/debug-${filename}`, fullPage: false })
      console.error(`[debug] saved /tmp/debug-${filename} for selector "${opts.waitFor}"`)
      throw e
    }
  }
  if (opts.after) await opts.after(appWin)
  const file = path.join(OUT_DIR, `raw-${filename}`)
  await appWin.screenshot({ path: file, fullPage: false })
  return file
}

async function wrap(chromium_, rawPath, outPath) {
  const raw = await fs.readFile(rawPath)
  const dataUri = `data:image/png;base64,${raw.toString('base64')}`
  const html = `<!doctype html><html><body style="margin:0;background:transparent">
  <div id="wrap" style="
    display:inline-block;
    padding:${WRAP_MARGIN}px;
    background:transparent;
  ">
    <div style="
      border-radius:${WRAP_RADIUS}px;
      overflow:hidden;
      box-shadow:
        0 30px 80px -20px rgba(17,24,39,0.35),
        0 10px 25px -10px rgba(17,24,39,0.22),
        0 0 0 1px rgba(17,24,39,0.08);
      line-height:0;
    ">
      <img src="${dataUri}" style="display:block;width:${VIEWPORT.width}px;height:auto"/>
    </div>
  </div>
  </body></html>`
  const browser = await chromium_.launch()
  const page = await browser.newPage({
    viewport: { width: VIEWPORT.width + WRAP_MARGIN * 2 + 40, height: VIEWPORT.height + WRAP_MARGIN * 2 + 40 }
  })
  await page.setContent(html)
  const loc = page.locator('#wrap')
  await loc.screenshot({ path: outPath, omitBackground: true })
  await browser.close()
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  // Ensure we start from a clean demo vault — otherwise leftovers from an aborted
  // previous run accumulate and inflate card counts in the captured screenshots.
  await fs.rm(TMP_VAULT, { recursive: true, force: true })
  await fs.mkdir(TMP_VAULT, { recursive: true })

  // Back up + swap config. Tolerate missing config (first-launch Electron userData).
  let originalCfg = null
  try { originalCfg = await fs.readFile(CONFIG_PATH, 'utf8') } catch { /* none yet */ }
  if (originalCfg) await fs.writeFile(BACKUP, originalCfg)
  const parsed = originalCfg ? JSON.parse(originalCfg) : {}
  const demoCfg = { ...parsed, rootPath: TMP_VAULT, theme: 'light' }
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
  await fs.writeFile(CONFIG_PATH, JSON.stringify(demoCfg, null, 2))
  await writeDemoState(TMP_VAULT)

  let app
  try {
    app = await electron.launch({
      args: [MAIN],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
    })
    const win = await app.firstWindow()
    await win.setViewportSize(VIEWPORT)
    await win.waitForLoadState('domcontentloaded')
    await win.waitForSelector('a[href*="/review"]', { timeout: 10000 })
    await win.waitForTimeout(400)

    console.log('[seed] seeding demo cards…')
    await seed(win)
    await win.waitForTimeout(600)

    // Routes to capture.
    const raws = []
    raws.push(await captureRoute(win, '#/review', 'review.png', {
      waitFor: 'button:has-text("Reveal answer")'
    }))
    raws.push(await captureRoute(win, '#/review', 'review-revealed.png', {
      waitFor: 'button:has-text("Reveal answer")',
      after: async (w) => {
        await w.locator('button:has-text("Reveal answer")').click()
        await w.waitForSelector('button:has-text("Good")', { timeout: 3000 })
      }
    }))
    raws.push(await captureRoute(win, '#/browse', 'browse.png'))
    raws.push(await captureRoute(win, '#/dashboard', 'dashboard.png', { waitMs: 900 }))

    // Editor — open the first card.
    const firstId = (await win.evaluate(async () => {
      const r = await window.api.listCards()
      return r.ok ? r.data[0]?.id : null
    }))
    if (firstId) {
      raws.push(await captureRoute(win, `#/editor/${firstId}`, 'editor.png', { waitMs: 700 }))
    }

    await app.close()
    app = null

    console.log('[wrap] applying rounded corners + shadow…')
    for (const raw of raws) {
      const name = path.basename(raw).replace(/^raw-/, '')
      const final = path.join(OUT_DIR, name)
      await wrap(chromium, raw, final)
      await fs.unlink(raw)
      console.log('  ✓', name)
    }
  } finally {
    if (app) await app.close().catch(() => {})
    if (originalCfg) {
      await fs.writeFile(CONFIG_PATH, originalCfg)
      await fs.unlink(BACKUP).catch(() => {})
    } else {
      await fs.unlink(CONFIG_PATH).catch(() => {})
    }
    await fs.rm(TMP_VAULT, { recursive: true, force: true })
    console.log('[cleanup] restored config, removed demo vault')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
