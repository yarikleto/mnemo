// Seed a temp vault + userData dir with rich, realistic data so screenshots
// represent a real, daily-driven user. Writes:
//   <vault>/cards/<namespace>/<slug>.md   — markdown cards with front-matter
//   <vault>/state/<id>.json               — FSRS review state (mix of due/leech/mastered)
//   <userData>/config.json                — points at the vault, theme=light by default
//
// Usage:
//   node .claude/reviews/seed.mjs <vault-dir> <userData-dir> [theme]

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function encodeTime(now, len) {
  let out = ''
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32
    out = ENCODING[mod] + out
    now = (now - mod) / 32
  }
  return out
}
function encodeRandom(len) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ENCODING[bytes[i] % 32]
  return out
}
function ulid() {
  return encodeTime(Date.now(), 10) + encodeRandom(16)
}

function yamlSingleQuoted(s) { return `'${s.replace(/'/g, "''")}'` }

function serialize(fm, body) {
  const lines = ['---']
  lines.push(`id: ${fm.id}`)
  lines.push('prompts:')
  for (const p of fm.prompts) {
    lines.push(`  - id: ${p.id}`)
    lines.push(`    text: ${yamlSingleQuoted(p.text)}`)
  }
  if (!fm.tags || fm.tags.length === 0) {
    lines.push('tags: []')
  } else {
    lines.push('tags:')
    for (const t of fm.tags) lines.push(`  - ${yamlSingleQuoted(t)}`)
  }
  lines.push(`created: '${fm.created}'`)
  lines.push('---')
  lines.push('')
  return `${lines.join('\n')}\n${body.endsWith('\n') ? body : body + '\n'}`
}

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const cards = [
  { ns: 'languages/japanese', prompts: ['What does **常識** (jōshiki) mean?', 'Use 常識 in a sentence.'], tags: ['japanese', 'vocab'], body: '**Common sense**, conventional wisdom. The shared social knowledge a member of the in-group is expected to have.\n\n> 彼には常識がない。 — *He has no common sense.*\n\nContrast with 知識 (*chishiki*, factual knowledge).' },
  { ns: 'languages/japanese', prompts: ['How do you say "I have to do X" in Japanese?'], tags: ['japanese', 'grammar'], body: 'Three patterns, increasingly casual:\n\n- **〜なければなりません** — formal\n- **〜なきゃいけない** — casual\n- **〜なくちゃ** — super casual / spoken\n\n```\n勉強しなくちゃ。 — I gotta study.\n```' },
  { ns: 'languages/spanish', prompts: ['Conjugate *ser* in the preterite (yo, tú, él, nosotros, vosotros, ellos).'], tags: ['spanish', 'verbs'], body: 'fui · fuiste · fue · fuimos · fuisteis · fueron\n\nIdentical to *ir* in the preterite — context disambiguates.\n\n> *Fui al mercado* could mean **I went** or **I was at** the market.' },
  { ns: 'languages/spanish', prompts: ['When do you use *por* vs *para*?'], tags: ['spanish', 'grammar'], body: 'Rule of thumb:\n\n- **por** — cause, motive, exchange ("because of", "in exchange for")\n- **para** — purpose, recipient, deadline ("in order to", "for someone")\n\n| Phrase | Use |\n|---|---|\n| *Trabajo por dinero* | por (in exchange) |\n| *Trabajo para mi jefe* | para (recipient) |\n' },
  { ns: 'algorithms/graphs', prompts: ['What is the time complexity of Dijkstra with a binary heap?', 'Why does Dijkstra fail with negative weights?'], tags: ['algorithms', 'graphs'], body: '**O((V + E) log V)** with a binary heap.\n\nWith a Fibonacci heap, decrease-key drops to amortized O(1), giving **O(E + V log V)** — better for dense graphs.\n\n```python\nimport heapq\n\ndef dijkstra(graph, source):\n    dist = {v: float("inf") for v in graph}\n    dist[source] = 0\n    pq = [(0, source)]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist[u]: continue\n        for v, w in graph[u]:\n            nd = d + w\n            if nd < dist[v]:\n                dist[v] = nd\n                heapq.heappush(pq, (nd, v))\n    return dist\n```' },
  { ns: 'algorithms/graphs', prompts: ['Topological sort: when does it exist?'], tags: ['algorithms'], body: 'A DAG is required. The graph must have **no cycles**, otherwise no valid linear ordering exists.\n\nKahn\'s algorithm produces one in O(V + E):\n\n1. Push all 0-indegree nodes onto a queue.\n2. Pop u → emit u → decrement v.indegree for every (u, v).\n3. If a v hits indegree 0, push it.\n4. If you emit < V nodes, the graph has a cycle.' },
  { ns: 'algorithms/dp', prompts: ['What problem does the longest-increasing-subsequence (LIS) algorithm solve, and what is its complexity?'], tags: ['algorithms', 'dp'], body: 'Given an array, find the longest subsequence (not contiguous) whose elements are strictly increasing.\n\n- **Naïve DP** — O(n²), classic two-pointer comparison.\n- **Patience sort + binary search** — O(n log n). Maintain a tails array; for each x, binary-search the first tail ≥ x and replace it.\n\nLength of `tails` at the end is the LIS length.' },
  { ns: 'algorithms/dp', prompts: ['Knapsack 0/1: state and recurrence?'], tags: ['algorithms', 'dp'], body: '**State:** `dp[i][w]` = max value using first *i* items with capacity *w*.\n\n**Recurrence:**\n```\ndp[i][w] = max(\n  dp[i-1][w],                       // skip\n  dp[i-1][w - wt[i]] + val[i]       // take, if wt[i] ≤ w\n)\n```\n\nO(nW) time, O(nW) space (or O(W) rolling).' },
  { ns: 'medicine/anatomy', prompts: ['Name the four chambers of the heart and the valve that separates each from its neighbor.'], tags: ['medicine', 'anatomy'], body: 'Right atrium → **tricuspid** → right ventricle → **pulmonary** → pulmonary artery\n\nLeft atrium → **mitral** (bicuspid) → left ventricle → **aortic** → aorta\n\nMnemonic: **TR**y **P**a**M**ela **A**nderson — *Tricuspid, Pulmonary, Mitral, Aortic.*' },
  { ns: 'medicine/anatomy', prompts: ['What is the difference between systole and diastole?'], tags: ['medicine'], body: '**Systole** — contraction phase. Ventricles squeeze; blood is ejected. Higher BP number (e.g. **120**/80).\n\n**Diastole** — relaxation phase. Ventricles fill. Lower BP number (120/**80**).\n\nDuring diastole, the atrioventricular valves are open; during systole, the semilunar valves are open.' },
  { ns: 'medicine/pharmacology', prompts: ['What is a beta-blocker, and name two clinical uses.'], tags: ['medicine'], body: 'Antagonist at **β-adrenergic receptors**. Blocks the sympathetic "fight or flight" cardiac response.\n\nUses:\n- **Hypertension** — reduces heart rate and contractility\n- **Atrial fibrillation** — slows ventricular response\n- Migraine prophylaxis, performance anxiety, hyperthyroidism (off-label)\n\nExamples: *propranolol*, *metoprolol*, *atenolol*.' },
  { ns: 'css', prompts: ['What\'s the difference between `display: block`, `inline`, and `inline-block`?'], tags: ['css', 'fundamentals'], body: '- **block** — takes up full width by default, starts on a new line, respects `width`/`height`/margins.\n- **inline** — flows with text, *cannot* have `width`/`height`, vertical margins ignored.\n- **inline-block** — flows like inline (no line break) but respects box-model properties.\n\n`<span>` defaults to inline; `<div>` to block. `<button>` is inline-block.' },
  { ns: 'css', prompts: ['Explain the CSS box-model.'], tags: ['css'], body: 'Every element is a box made of 4 concentric rectangles:\n\n1. **Content** — the actual text/image\n2. **Padding** — inside the border, transparent\n3. **Border** — visible edge\n4. **Margin** — outside the border, transparent, collapses with neighbors\n\n`box-sizing: border-box` makes `width` include padding + border, which is what you almost always want.' },
  { ns: 'rust', prompts: ['What is ownership in Rust, in one sentence?', 'Why does Rust prevent two mutable references to the same value?'], tags: ['rust'], body: 'Every value has a single **owner** — when the owner goes out of scope, the value is dropped. References must follow strict **borrow** rules: any number of `&T` *or* exactly one `&mut T`, never both.\n\nThis eliminates a whole class of memory-safety bugs (use-after-free, data races) at compile time, with zero runtime overhead.\n\n```rust\nlet s = String::from("hello");\nlet a = &s;            // OK: shared borrow\nlet b = &s;            // OK: another shared borrow\n// let c = &mut s;     // ❌ cannot borrow as mutable while &s exists\n```' },
  { ns: 'rust', prompts: ['When do you reach for `Rc<RefCell<T>>`?'], tags: ['rust'], body: '`Rc<T>` — multiple **shared immutable** owners (single-threaded).\n`RefCell<T>` — **interior mutability**, runtime-checked borrow rules.\n\nCombined: many owners that each need to mutate. The classic use is graph-like data structures where the borrow checker can\'t prove tree-shape statically.\n\nIn multi-threaded code, swap for `Arc<Mutex<T>>`.' }
]

async function main() {
  const [vaultDir, userDataDir, theme = 'light'] = process.argv.slice(2)
  if (!vaultDir || !userDataDir) {
    console.error('Usage: node seed.mjs <vault-dir> <userData-dir> [theme]')
    process.exit(1)
  }

  await fs.rm(vaultDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
  await fs.mkdir(path.join(vaultDir, 'cards'), { recursive: true })
  await fs.mkdir(path.join(vaultDir, 'state'), { recursive: true })
  await fs.mkdir(userDataDir, { recursive: true })

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  // Build a recent-history pattern: 60 days of activity, irregular gaps for realism.
  function reviewHistory(daysBack, density = 1) {
    const out = []
    for (let d = daysBack; d >= 0; d--) {
      // skip random days for irregular streak look
      if (Math.random() > density) continue
      const reviewsToday = 1 + Math.floor(Math.random() * 4)
      for (let r = 0; r < reviewsToday; r++) {
        const ts = new Date(now - d * dayMs - Math.random() * dayMs).toISOString()
        const rating = ['Again', 'Hard', 'Good', 'Good', 'Good', 'Easy'][Math.floor(Math.random() * 6)]
        out.push({ ts, rating, elapsed_days: 1 + Math.floor(Math.random() * 7) })
      }
    }
    return out
  }

  let cardIdx = 0
  for (const c of cards) {
    cardIdx++
    const id = ulid()
    const prompts = c.prompts.map(text => ({ id: ulid(), text }))
    const created = new Date(now - (180 - cardIdx * 8) * dayMs).toISOString()
    const fm = { id, prompts, tags: c.tags ?? [], created }

    const dir = path.join(vaultDir, 'cards', c.ns)
    await fs.mkdir(dir, { recursive: true })
    const slug = slugify(c.prompts[0]) || id
    await fs.writeFile(path.join(dir, `${slug}.md`), serialize(fm, c.body))

    // Mix of states for screenshot variety:
    //   - 4 cards due NOW (will appear in /review)
    //   - 3 leeches (lots of lapses, low retention)
    //   - 4 mastered (long stability, strong retention)
    //   - rest scattered in the future
    let due, stability, difficulty, lapses, reps, state
    if (cardIdx <= 4) {
      // Due today
      due = new Date(now - 1 * 60 * 60 * 1000).toISOString()
      stability = 5 + Math.random() * 10
      difficulty = 3 + Math.random() * 4
      lapses = Math.floor(Math.random() * 2)
      reps = 4 + Math.floor(Math.random() * 8)
      state = 'Review'
    } else if (cardIdx <= 7) {
      // Leeches — many lapses, due soon, low retention
      due = new Date(now + Math.floor(Math.random() * 3) * dayMs).toISOString()
      stability = 1 + Math.random() * 2
      difficulty = 7 + Math.random() * 2
      lapses = 4 + Math.floor(Math.random() * 4)
      reps = 8 + Math.floor(Math.random() * 8)
      state = 'Review'
    } else if (cardIdx <= 11) {
      // Mastered — long intervals, no lapses
      due = new Date(now + (60 + Math.random() * 200) * dayMs).toISOString()
      stability = 100 + Math.random() * 150
      difficulty = 1 + Math.random() * 2
      lapses = 0
      reps = 12 + Math.floor(Math.random() * 20)
      state = 'Review'
    } else {
      // Scattered future
      due = new Date(now + (5 + Math.random() * 30) * dayMs).toISOString()
      stability = 10 + Math.random() * 30
      difficulty = 4 + Math.random() * 3
      lapses = 1 + Math.floor(Math.random() * 2)
      reps = 5 + Math.floor(Math.random() * 6)
      state = 'Review'
    }

    const reviewState = {
      id,
      due,
      stability,
      difficulty,
      elapsed_days: Math.max(1, Math.floor(stability / 2)),
      scheduled_days: Math.max(1, Math.floor(stability)),
      reps,
      lapses,
      state,
      last_review: new Date(now - Math.random() * 7 * dayMs).toISOString(),
      history: reviewHistory(60, 0.55)
    }
    await fs.writeFile(
      path.join(vaultDir, 'state', `${id}.json`),
      JSON.stringify(reviewState, null, 2)
    )
  }

  const config = {
    rootPath: vaultDir,
    theme, // 'light' | 'dark' | 'system'
    dashboard: {
      widgets: [
        { id: 'due-forecast',      enabled: true, order: 0 },
        { id: 'key-stats',         enabled: true, order: 1 },
        { id: 'namespace-ranking', enabled: true, order: 2 },
        { id: 'leech-list',        enabled: true, order: 3 },
        { id: 'heatmap',           enabled: true, order: 4 },
        { id: 'activity-streak',   enabled: true, order: 5 }
      ]
    },
    fsrs: { desiredRetention: 0.9, maximumInterval: 365 },
    externalEditor: null
  }
  await fs.writeFile(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2))

  console.log(`Seeded ${cards.length} cards into ${vaultDir}`)
  console.log(`Config in ${userDataDir} (theme=${theme})`)
}

main().catch(e => { console.error(e); process.exit(1) })
