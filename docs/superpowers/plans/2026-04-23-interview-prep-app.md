# SWE Interview Prep App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Electron app for SWE interview prep with FSRS spaced repetition, markdown-backed cards in nested namespaces, in-app + external editing, and a customizable dashboard.

**Architecture:** Electron with a strict two-process split. Renderer is React + Vite + TypeScript + Tailwind + shadcn/ui; all filesystem and scheduling work happens in the main process. Cards are `.md` files with YAML frontmatter under `cards/` (nested folders = namespaces). FSRS state is one JSON file per card under `state/`, keyed by ULID. IPC is a typed, Zod-validated surface exposed via `contextBridge`.

**Tech Stack:** Electron, Vite, React 18, TypeScript, Tailwind, shadcn/ui, Zustand, CodeMirror 6, `unified`/`remark`/`rehype`/Shiki, `ts-fsrs`, `chokidar`, `gray-matter`, `ulid`, `flexsearch`, Zod, Vitest, Playwright, `electron-builder`.

**Spec:** `docs/superpowers/specs/2026-04-23-interview-prep-app-design.md`

---

## Repository layout produced by this plan

```
anki/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  electron-builder.yml
  index.html
  src/
    main/
      index.ts
      ipc/
        register.ts
      store/
        config.ts
        cards.ts
        state.ts
        index.ts
      fsrs/
        scheduler.ts
        queue.ts
      markdown/
        parse.ts
      watcher.ts
      editor-open.ts
      paths.ts
      atomic-write.ts
    preload/
      index.ts
    renderer/
      main.tsx
      app.tsx
      routes/
        review.tsx
        browse.tsx
        editor.tsx
        dashboard.tsx
        settings.tsx
        onboarding.tsx
      components/
        sidebar.tsx
        namespace-tree.tsx
        theme-toggle.tsx
        markdown-view.tsx
        widgets/
          due-forecast.tsx
          namespace-ranking.tsx
          leech-list.tsx
          heatmap.tsx
          activity-streak.tsx
          key-stats.tsx
      stores/
        app-store.ts
      styles/
        index.css
      lib/
        api.ts
    shared/
      api.ts
      schema.ts
      constants.ts
  tests/
    unit/
    integration/
    e2e/
```

---

## Task 1: Initialize project, TypeScript, and package metadata

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "interview-prep",
  "version": "0.1.0",
  "description": "Spaced-repetition SWE interview prep app",
  "private": true,
  "main": "dist-electron/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "dist": "npm run build && electron-builder",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win",
    "dist:linux": "npm run build && electron-builder --linux"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "flexsearch": "^0.7.43",
    "gray-matter": "^4.0.3",
    "rehype-react": "^8.0.0",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.0",
    "shiki": "^1.10.0",
    "ts-fsrs": "^4.4.0",
    "ulid": "^2.3.0",
    "unified": "^11.0.5",
    "zod": "^3.23.8",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "postcss": "^8.4.38",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "electron-builder.yml"]
}
```

- [ ] **Step 5: Append to `.gitignore`**

```
node_modules/
dist/
dist-electron/
out/
.vite/
coverage/
*.log
.DS_Store
```

- [ ] **Step 6: Create `.editorconfig`**

```
root = true
[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 7: Install**

```bash
npm install
```

Expected: clean install, no peer-dep errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json .nvmrc .editorconfig .gitignore
git commit -m "chore: initialize TypeScript project"
```

---

## Task 2: Vite + Electron bundling configuration

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/renderer/main.tsx` (placeholder)
- Create: `src/renderer/app.tsx` (placeholder)
- Create: `src/main/index.ts` (placeholder)
- Create: `src/preload/index.ts` (placeholder)

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: { external: ['electron', 'chokidar', 'fsevents'] }
          }
        }
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: { outDir: 'dist-electron/preload' }
        }
      },
      renderer: {}
    })
  ],
  build: { outDir: 'dist' }
})
```

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interview Prep</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create placeholder `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Create placeholder `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 5: Create placeholder `src/renderer/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create placeholder `src/renderer/app.tsx`**

```tsx
export function App() {
  return <div style={{ padding: 24, fontFamily: 'system-ui' }}>Interview Prep — bootstrapping</div>
}
```

- [ ] **Step 7: Verify dev server launches Electron**

Run: `npm run dev`
Expected: Vite dev server starts, Electron window opens, renders "Interview Prep — bootstrapping".
Close the window to return to the terminal.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts index.html src/
git commit -m "chore: bootstrap electron + vite + react scaffold"
```

---

## Task 3: Tailwind CSS + base styles

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/renderer/styles/index.css`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Charter', 'Georgia', 'Cambria', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)'
      }
    }
  }
} satisfies Config
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 3: Create `src/renderer/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: 255 255 255;
  --fg: 23 23 29;
  --muted: 120 120 128;
  --border: 230 230 232;
  --accent: 46 125 91;
}
.dark {
  --bg: 11 12 16;
  --fg: 232 233 237;
  --muted: 139 141 152;
  --border: 30 31 38;
  --accent: 167 139 250;
}

html, body, #root { height: 100%; }
body {
  @apply bg-bg text-fg font-sans antialiased;
}
```

- [ ] **Step 4: Import stylesheet in `src/renderer/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Replace `src/renderer/app.tsx` with styled placeholder**

```tsx
export function App() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Interview Prep</h1>
      <p className="text-muted mt-2">Bootstrapping…</p>
    </div>
  )
}
```

- [ ] **Step 6: Verify**

Run: `npm run dev`
Expected: heading renders with Inter sans-serif; muted text gray.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts postcss.config.js src/renderer/
git commit -m "feat(ui): add tailwind with theme tokens"
```

---

## Task 4: Shared schemas (Zod + TypeScript types)

**Files:**
- Create: `src/shared/schema.ts`
- Create: `src/shared/constants.ts`
- Create: `tests/unit/schema.test.ts`

- [ ] **Step 1: Create `src/shared/constants.ts`**

```ts
export const RATINGS = ['Again', 'Hard', 'Good', 'Easy'] as const
export type Rating = typeof RATINGS[number]

export const FSRS_STATES = ['New', 'Learning', 'Review', 'Relearning'] as const
export type FsrsState = typeof FSRS_STATES[number]

export const WIDGET_IDS = [
  'due-forecast',
  'namespace-ranking',
  'leech-list',
  'heatmap',
  'activity-streak',
  'key-stats'
] as const
export type WidgetId = typeof WIDGET_IDS[number]
```

- [ ] **Step 2: Create `src/shared/schema.ts`**

```ts
import { z } from 'zod'
import { RATINGS, FSRS_STATES, WIDGET_IDS } from './constants'

export const CardFrontmatterSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  tags: z.array(z.string()).default([]),
  created: z.string().datetime()
})
export type CardFrontmatter = z.infer<typeof CardFrontmatterSchema>

export const CardMetaSchema = CardFrontmatterSchema.extend({
  namespace: z.string(),          // e.g. "system-design/caching"
  path: z.string(),               // absolute path
  mtime: z.number(),
  bodyHash: z.string()
})
export type CardMeta = z.infer<typeof CardMetaSchema>

export const CardFullSchema = CardMetaSchema.extend({
  body: z.string()
})
export type CardFull = z.infer<typeof CardFullSchema>

export const ReviewHistoryEntrySchema = z.object({
  ts: z.string().datetime(),
  rating: z.enum(RATINGS),
  elapsed_days: z.number()
})

export const ReviewStateSchema = z.object({
  id: z.string(),
  due: z.string().datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.enum(FSRS_STATES),
  last_review: z.string().datetime().nullable(),
  history: z.array(ReviewHistoryEntrySchema).default([])
})
export type ReviewState = z.infer<typeof ReviewStateSchema>

export const DashboardWidgetConfigSchema = z.object({
  id: z.enum(WIDGET_IDS),
  enabled: z.boolean(),
  order: z.number().int().min(0)
})

export const ConfigSchema = z.object({
  rootPath: z.string(),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  dashboard: z.object({
    widgets: z.array(DashboardWidgetConfigSchema)
  }),
  fsrs: z.object({
    desiredRetention: z.number().min(0.5).max(0.99).default(0.9),
    maximumInterval: z.number().int().positive().default(36500)
  }),
  externalEditor: z.string().nullable().default(null)
})
export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Omit<Config, 'rootPath'> = {
  theme: 'system',
  dashboard: {
    widgets: [
      { id: 'due-forecast', enabled: true, order: 0 },
      { id: 'namespace-ranking', enabled: true, order: 1 },
      { id: 'leech-list', enabled: true, order: 2 },
      { id: 'heatmap', enabled: false, order: 3 },
      { id: 'activity-streak', enabled: false, order: 4 },
      { id: 'key-stats', enabled: false, order: 5 }
    ]
  },
  fsrs: { desiredRetention: 0.9, maximumInterval: 36500 },
  externalEditor: null
}
```

- [ ] **Step 3: Create test `tests/unit/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { CardFrontmatterSchema, ReviewStateSchema, ConfigSchema, DEFAULT_CONFIG } from '../../src/shared/schema'

describe('CardFrontmatterSchema', () => {
  it('accepts a valid frontmatter', () => {
    const fm = {
      id: '01HXYZ',
      question: 'What is CAP theorem?',
      tags: ['distributed'],
      created: '2026-04-23T10:00:00.000Z'
    }
    expect(CardFrontmatterSchema.parse(fm)).toEqual(fm)
  })

  it('defaults tags to empty array', () => {
    const fm = { id: '1', question: 'q', created: '2026-04-23T10:00:00.000Z' }
    expect(CardFrontmatterSchema.parse(fm).tags).toEqual([])
  })

  it('rejects missing question', () => {
    expect(() => CardFrontmatterSchema.parse({ id: '1', created: '2026-04-23T10:00:00.000Z' })).toThrow()
  })
})

describe('ReviewStateSchema', () => {
  it('accepts null last_review', () => {
    const state = {
      id: '1', due: '2026-04-25T00:00:00.000Z', stability: 1, difficulty: 5,
      elapsed_days: 0, scheduled_days: 1, reps: 0, lapses: 0, state: 'New' as const,
      last_review: null, history: []
    }
    expect(ReviewStateSchema.parse(state)).toEqual(state)
  })
})

describe('ConfigSchema', () => {
  it('parses a default config with a root path', () => {
    const parsed = ConfigSchema.parse({ rootPath: '/tmp/x', ...DEFAULT_CONFIG })
    expect(parsed.rootPath).toBe('/tmp/x')
    expect(parsed.dashboard.widgets).toHaveLength(6)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npm test -- schema`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared tests/unit/schema.test.ts
git commit -m "feat(shared): add Zod schemas for cards, state, config"
```

---

## Task 5: Shared API type surface

**Files:**
- Create: `src/shared/api.ts`

- [ ] **Step 1: Create `src/shared/api.ts`**

```ts
import type { CardFull, CardMeta, ReviewState, Config } from './schema'
import type { Rating, WidgetId } from './constants'

export type NamespaceNode = {
  name: string
  path: string                 // e.g. "system-design/caching"
  dueCount: number
  children: NamespaceNode[]
}

export type DashboardData = Partial<{
  dueForecast: { today: number; next7Days: number[] }
  namespaceRanking: Array<{ namespace: string; retention: number; count: number }>
  leechList: Array<{ id: string; question: string; lapses: number; namespace: string }>
  heatmap: Array<{ id: string; question: string; retention: number; namespace: string }>
  activityStreak: { days: Array<{ date: string; count: number }>; currentStreak: number; total: number }
  keyStats: { total: number; retention: number; struggling: number; mastered: number }
}>

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface Api {
  listNamespaces(): Promise<ApiResult<NamespaceNode>>
  listCards(namespace?: string): Promise<ApiResult<CardMeta[]>>
  getDueQueue(filter: { namespaces?: string[] }): Promise<ApiResult<CardMeta[]>>
  readCard(id: string): Promise<ApiResult<CardFull>>
  getDashboardData(widgets: WidgetId[]): Promise<ApiResult<DashboardData>>

  createCard(input: { namespace: string; question: string; body: string; tags?: string[] }): Promise<ApiResult<CardFull>>
  updateCard(input: { id: string; question?: string; body?: string; tags?: string[] }): Promise<ApiResult<CardFull>>
  moveCard(input: { id: string; namespace: string }): Promise<ApiResult<CardFull>>
  deleteCard(id: string): Promise<ApiResult<void>>
  rateReview(input: { id: string; rating: Rating }): Promise<ApiResult<ReviewState>>
  openInExternalEditor(id: string): Promise<ApiResult<void>>

  getConfig(): Promise<ApiResult<Config>>
  updateConfig(patch: Partial<Config>): Promise<ApiResult<Config>>

  searchCards(query: string): Promise<ApiResult<CardMeta[]>>
  rescan(): Promise<ApiResult<void>>

  onCardChanged(cb: (id: string) => void): () => void
  onCardAdded(cb: (id: string) => void): () => void
  onCardRemoved(cb: (id: string) => void): () => void
  onIndexRebuilt(cb: () => void): () => void
}

declare global {
  interface Window {
    api: Api
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/api.ts
git commit -m "feat(shared): define typed IPC API surface"
```

---

## Task 6: Path resolution and atomic write helpers

**Files:**
- Create: `src/main/paths.ts`
- Create: `src/main/atomic-write.ts`
- Create: `tests/unit/atomic-write.test.ts`

- [ ] **Step 1: Create `src/main/paths.ts`**

```ts
import path from 'node:path'
import { app } from 'electron'

export function defaultRootPath(): string {
  return path.join(app.getPath('documents'), 'interview-prep')
}

export function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function cardsDir(rootPath: string): string {
  return path.join(rootPath, 'cards')
}

export function stateDir(rootPath: string): string {
  return path.join(rootPath, 'state')
}

export function stateFile(rootPath: string, id: string): string {
  return path.join(stateDir(rootPath), `${id}.json`)
}

export function namespaceFromPath(rootPath: string, absPath: string): string {
  const rel = path.relative(cardsDir(rootPath), absPath)
  const dir = path.dirname(rel)
  return dir === '.' ? '' : dir.split(path.sep).join('/')
}
```

- [ ] **Step 2: Create `src/main/atomic-write.ts`**

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export async function atomicWrite(targetPath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.${crypto.randomBytes(6).toString('hex')}.tmp`
  await fs.writeFile(tmp, contents, 'utf8')
  await fs.rename(tmp, targetPath)
}

export function hashBody(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
}
```

- [ ] **Step 3: Write test `tests/unit/atomic-write.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { atomicWrite, hashBody } from '../../src/main/atomic-write'

describe('atomicWrite', () => {
  let tmp: string
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'aw-'))
  })
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true })
  })

  it('writes contents to disk', async () => {
    const f = path.join(tmp, 'sub', 'out.txt')
    await atomicWrite(f, 'hello')
    expect(await fs.readFile(f, 'utf8')).toBe('hello')
  })

  it('leaves no .tmp files behind', async () => {
    const f = path.join(tmp, 'out.txt')
    await atomicWrite(f, 'x')
    const entries = await fs.readdir(tmp)
    expect(entries.every(e => !e.endsWith('.tmp'))).toBe(true)
  })

  it('overwrites existing file', async () => {
    const f = path.join(tmp, 'out.txt')
    await atomicWrite(f, 'first')
    await atomicWrite(f, 'second')
    expect(await fs.readFile(f, 'utf8')).toBe('second')
  })
})

describe('hashBody', () => {
  it('is deterministic', () => {
    expect(hashBody('abc')).toBe(hashBody('abc'))
  })
  it('differs for different inputs', () => {
    expect(hashBody('a')).not.toBe(hashBody('b'))
  })
})
```

- [ ] **Step 4: Run test**

Run: `npm test -- atomic-write`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/paths.ts src/main/atomic-write.ts tests/unit/atomic-write.test.ts
git commit -m "feat(main): add path helpers and atomic write"
```

---

## Task 7: Markdown frontmatter parser/serializer

**Files:**
- Create: `src/main/markdown/parse.ts`
- Create: `tests/unit/markdown-parse.test.ts`

- [ ] **Step 1: Create `src/main/markdown/parse.ts`**

```ts
import matter from 'gray-matter'
import { CardFrontmatterSchema, type CardFrontmatter } from '../../shared/schema'

export type ParsedCard = { frontmatter: CardFrontmatter; body: string }

export function parseCardFile(raw: string): ParsedCard {
  const parsed = matter(raw)
  const frontmatter = CardFrontmatterSchema.parse(parsed.data)
  return { frontmatter, body: parsed.content.replace(/^\n/, '') }
}

export function serializeCardFile(frontmatter: CardFrontmatter, body: string): string {
  const fmBlock = matter.stringify('', frontmatter).replace(/\n$/, '')
  return `${fmBlock}\n\n${body.endsWith('\n') ? body : body + '\n'}`
}
```

- [ ] **Step 2: Write test `tests/unit/markdown-parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseCardFile, serializeCardFile } from '../../src/main/markdown/parse'

describe('parseCardFile', () => {
  it('extracts frontmatter and body', () => {
    const raw = `---\nid: "abc"\nquestion: "What?"\ntags: [a, b]\ncreated: "2026-04-23T10:00:00.000Z"\n---\n\nBody **markdown** here.\n`
    const { frontmatter, body } = parseCardFile(raw)
    expect(frontmatter.id).toBe('abc')
    expect(frontmatter.question).toBe('What?')
    expect(frontmatter.tags).toEqual(['a', 'b'])
    expect(body.trim()).toBe('Body **markdown** here.')
  })

  it('roundtrips', () => {
    const fm = { id: 'x', question: 'Q?', tags: ['t'], created: '2026-04-23T10:00:00.000Z' }
    const body = 'Answer\n'
    const raw = serializeCardFile(fm, body)
    const parsed = parseCardFile(raw)
    expect(parsed.frontmatter).toEqual(fm)
    expect(parsed.body.trim()).toBe('Answer')
  })

  it('throws on missing required fields', () => {
    const raw = `---\ntags: [x]\n---\nbody\n`
    expect(() => parseCardFile(raw)).toThrow()
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- markdown-parse`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/markdown tests/unit/markdown-parse.test.ts
git commit -m "feat(main): frontmatter parse/serialize"
```

---

## Task 8: Config store

**Files:**
- Create: `src/main/store/config.ts`
- Create: `tests/unit/config-store.test.ts`

- [ ] **Step 1: Create `src/main/store/config.ts`**

```ts
import { promises as fs } from 'node:fs'
import { ConfigSchema, DEFAULT_CONFIG, type Config } from '../../shared/schema'
import { atomicWrite } from '../atomic-write'

export async function loadConfig(configFile: string, fallbackRootPath: string): Promise<Config> {
  try {
    const raw = await fs.readFile(configFile, 'utf8')
    return ConfigSchema.parse(JSON.parse(raw))
  } catch {
    const cfg: Config = { rootPath: fallbackRootPath, ...DEFAULT_CONFIG }
    await atomicWrite(configFile, JSON.stringify(cfg, null, 2))
    return cfg
  }
}

export async function saveConfig(configFile: string, cfg: Config): Promise<Config> {
  const validated = ConfigSchema.parse(cfg)
  await atomicWrite(configFile, JSON.stringify(validated, null, 2))
  return validated
}

export async function patchConfig(configFile: string, current: Config, patch: Partial<Config>): Promise<Config> {
  const merged = {
    ...current,
    ...patch,
    dashboard: patch.dashboard ?? current.dashboard,
    fsrs: patch.fsrs ? { ...current.fsrs, ...patch.fsrs } : current.fsrs
  }
  return saveConfig(configFile, merged)
}
```

- [ ] **Step 2: Write test `tests/unit/config-store.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadConfig, saveConfig, patchConfig } from '../../src/main/store/config'

describe('config store', () => {
  let dir: string
  let file: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfg-'))
    file = path.join(dir, 'config.json')
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('creates a default config when file is missing', async () => {
    const cfg = await loadConfig(file, '/tmp/data')
    expect(cfg.rootPath).toBe('/tmp/data')
    expect(cfg.dashboard.widgets).toHaveLength(6)
    const disk = JSON.parse(await fs.readFile(file, 'utf8'))
    expect(disk.rootPath).toBe('/tmp/data')
  })

  it('loads an existing config', async () => {
    await loadConfig(file, '/tmp/a')
    const cfg = await loadConfig(file, '/ignored')
    expect(cfg.rootPath).toBe('/tmp/a')
  })

  it('patches theme without losing other fields', async () => {
    const cfg = await loadConfig(file, '/tmp/a')
    const updated = await patchConfig(file, cfg, { theme: 'dark' })
    expect(updated.theme).toBe('dark')
    expect(updated.dashboard.widgets).toHaveLength(6)
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- config-store`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/store/config.ts tests/unit/config-store.test.ts
git commit -m "feat(main): config store with atomic writes"
```

---

## Task 9: Cards store (read)

**Files:**
- Create: `src/main/store/cards.ts`
- Create: `tests/integration/cards-read.test.ts`

- [ ] **Step 1: Create `src/main/store/cards.ts`**

```ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ulid } from 'ulid'
import { parseCardFile, serializeCardFile } from '../markdown/parse'
import { atomicWrite, hashBody } from '../atomic-write'
import { cardsDir, namespaceFromPath } from '../paths'
import type { CardFull, CardMeta } from '../../shared/schema'

export async function walkCardFiles(rootPath: string): Promise<string[]> {
  const root = cardsDir(rootPath)
  await fs.mkdir(root, { recursive: true })
  const out: string[] = []
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
    }
  }
  await walk(root)
  return out
}

export async function readCardAtPath(rootPath: string, absPath: string): Promise<CardFull> {
  const raw = await fs.readFile(absPath, 'utf8')
  const { frontmatter, body } = parseCardFile(raw)
  const stat = await fs.stat(absPath)
  return {
    ...frontmatter,
    namespace: namespaceFromPath(rootPath, absPath),
    path: absPath,
    mtime: stat.mtimeMs,
    bodyHash: hashBody(body),
    body
  }
}

export function toMeta(full: CardFull): CardMeta {
  const { body, ...meta } = full
  void body
  return meta
}

export async function createCardOnDisk(
  rootPath: string,
  args: { namespace: string; question: string; body: string; tags?: string[] }
): Promise<CardFull> {
  const id = ulid()
  const now = new Date().toISOString()
  const dir = path.join(cardsDir(rootPath), args.namespace)
  await fs.mkdir(dir, { recursive: true })
  const slug = slugify(args.question)
  const file = path.join(dir, `${slug || id}.md`)
  const raw = serializeCardFile(
    { id, question: args.question, tags: args.tags ?? [], created: now },
    args.body
  )
  await atomicWrite(file, raw)
  return readCardAtPath(rootPath, file)
}

export async function updateCardOnDisk(
  absPath: string,
  patch: { question?: string; body?: string; tags?: string[] }
): Promise<void> {
  const raw = await fs.readFile(absPath, 'utf8')
  const { frontmatter, body } = parseCardFile(raw)
  const nextFm = {
    ...frontmatter,
    question: patch.question ?? frontmatter.question,
    tags: patch.tags ?? frontmatter.tags
  }
  const nextBody = patch.body ?? body
  await atomicWrite(absPath, serializeCardFile(nextFm, nextBody))
}

export async function moveCardOnDisk(
  rootPath: string,
  currentPath: string,
  newNamespace: string
): Promise<string> {
  const dir = path.join(cardsDir(rootPath), newNamespace)
  await fs.mkdir(dir, { recursive: true })
  const newPath = path.join(dir, path.basename(currentPath))
  await fs.rename(currentPath, newPath)
  return newPath
}

export async function deleteCardOnDisk(absPath: string): Promise<void> {
  await fs.unlink(absPath)
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
```

- [ ] **Step 2: Write test `tests/integration/cards-read.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  walkCardFiles, readCardAtPath, createCardOnDisk,
  updateCardOnDisk, moveCardOnDisk, deleteCardOnDisk
} from '../../src/main/store/cards'

describe('cards store', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'cards-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('creates and reads a card with correct namespace', async () => {
    const c = await createCardOnDisk(root, {
      namespace: 'system-design/caching',
      question: 'What is a CDN?',
      body: 'A distributed cache.',
      tags: ['networking']
    })
    expect(c.namespace).toBe('system-design/caching')
    expect(c.question).toBe('What is a CDN?')
    expect(c.tags).toEqual(['networking'])

    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(1)
    const read = await readCardAtPath(root, paths[0]!)
    expect(read.id).toBe(c.id)
  })

  it('updates question and body', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q1', body: 'B1' })
    await updateCardOnDisk(c.path, { question: 'Q2', body: 'B2' })
    const read = await readCardAtPath(root, c.path)
    expect(read.question).toBe('Q2')
    expect(read.body.trim()).toBe('B2')
  })

  it('moves a card to a new namespace preserving id', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    const newPath = await moveCardOnDisk(root, c.path, 'b/nested')
    const read = await readCardAtPath(root, newPath)
    expect(read.id).toBe(c.id)
    expect(read.namespace).toBe('b/nested')
  })

  it('deletes a card', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    await deleteCardOnDisk(c.path)
    const paths = await walkCardFiles(root)
    expect(paths).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- cards-read`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/store/cards.ts tests/integration/cards-read.test.ts
git commit -m "feat(main): cards store with atomic writes and move"
```

---

## Task 10: FSRS state store

**Files:**
- Create: `src/main/store/state.ts`
- Create: `tests/integration/state-store.test.ts`

- [ ] **Step 1: Create `src/main/store/state.ts`**

```ts
import { promises as fs } from 'node:fs'
import { stateFile, stateDir } from '../paths'
import { atomicWrite } from '../atomic-write'
import { ReviewStateSchema, type ReviewState } from '../../shared/schema'

export function newState(id: string): ReviewState {
  const nowIso = new Date().toISOString()
  return {
    id,
    due: nowIso,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
    history: []
  }
}

export async function readState(rootPath: string, id: string): Promise<ReviewState> {
  try {
    const raw = await fs.readFile(stateFile(rootPath, id), 'utf8')
    return ReviewStateSchema.parse(JSON.parse(raw))
  } catch {
    return newState(id)
  }
}

export async function writeState(rootPath: string, state: ReviewState): Promise<void> {
  const validated = ReviewStateSchema.parse(state)
  await atomicWrite(stateFile(rootPath, state.id), JSON.stringify(validated, null, 2))
}

export async function listStateIds(rootPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(stateDir(rootPath))
    return entries.filter(e => e.endsWith('.json')).map(e => e.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

export async function deleteState(rootPath: string, id: string): Promise<void> {
  try {
    await fs.unlink(stateFile(rootPath, id))
  } catch {
    /* idempotent */
  }
}
```

- [ ] **Step 2: Write test `tests/integration/state-store.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readState, writeState, listStateIds, deleteState } from '../../src/main/store/state'

describe('state store', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'st-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('returns a new state when none exists', async () => {
    const s = await readState(root, 'abc')
    expect(s.state).toBe('New')
    expect(s.reps).toBe(0)
  })

  it('roundtrips a state', async () => {
    const initial = await readState(root, 'abc')
    const updated = { ...initial, reps: 3, state: 'Review' as const, stability: 5 }
    await writeState(root, updated)
    const read = await readState(root, 'abc')
    expect(read.reps).toBe(3)
    expect(read.state).toBe('Review')
  })

  it('lists state ids', async () => {
    await writeState(root, { ...(await readState(root, 'x')), reps: 1 })
    await writeState(root, { ...(await readState(root, 'y')), reps: 1 })
    const ids = await listStateIds(root)
    expect(ids.sort()).toEqual(['x', 'y'])
  })

  it('deletes a state', async () => {
    await writeState(root, { ...(await readState(root, 'z')), reps: 1 })
    await deleteState(root, 'z')
    expect(await listStateIds(root)).not.toContain('z')
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- state-store`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/store/state.ts tests/integration/state-store.test.ts
git commit -m "feat(main): FSRS state store"
```

---

## Task 11: In-memory index

**Files:**
- Create: `src/main/store/index.ts`
- Create: `tests/integration/index-store.test.ts`

- [ ] **Step 1: Create `src/main/store/index.ts`**

```ts
import { walkCardFiles, readCardAtPath } from './cards'
import type { CardMeta } from '../../shared/schema'

export class CardIndex {
  private byId = new Map<string, CardMeta>()
  private byPath = new Map<string, string>() // path → id

  async buildFrom(rootPath: string): Promise<void> {
    this.byId.clear()
    this.byPath.clear()
    const paths = await walkCardFiles(rootPath)
    for (const p of paths) {
      try {
        const full = await readCardAtPath(rootPath, p)
        const { body, ...meta } = full
        void body
        this.byId.set(meta.id, meta)
        this.byPath.set(meta.path, meta.id)
      } catch (_err) {
        // corrupt frontmatter — skip (surfaced via rescan diagnostics in future)
      }
    }
  }

  get(id: string): CardMeta | undefined { return this.byId.get(id) }
  getByPath(p: string): CardMeta | undefined {
    const id = this.byPath.get(p)
    return id ? this.byId.get(id) : undefined
  }
  all(): CardMeta[] { return Array.from(this.byId.values()) }
  allIds(): string[] { return Array.from(this.byId.keys()) }
  upsert(meta: CardMeta): void {
    const prev = this.byId.get(meta.id)
    if (prev && prev.path !== meta.path) this.byPath.delete(prev.path)
    this.byId.set(meta.id, meta)
    this.byPath.set(meta.path, meta.id)
  }
  removeById(id: string): void {
    const meta = this.byId.get(id)
    if (meta) this.byPath.delete(meta.path)
    this.byId.delete(id)
  }
  removeByPath(p: string): string | undefined {
    const id = this.byPath.get(p)
    if (id) { this.byId.delete(id); this.byPath.delete(p) }
    return id
  }
}
```

- [ ] **Step 2: Write test `tests/integration/index-store.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CardIndex } from '../../src/main/store/index'
import { createCardOnDisk } from '../../src/main/store/cards'

describe('CardIndex', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'idx-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('builds from a directory of cards', async () => {
    await createCardOnDisk(root, { namespace: 'a', question: 'Q1', body: 'B1' })
    await createCardOnDisk(root, { namespace: 'a/b', question: 'Q2', body: 'B2' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    expect(idx.all()).toHaveLength(2)
  })

  it('upsert and removeById', async () => {
    const c = await createCardOnDisk(root, { namespace: 'a', question: 'Q', body: 'B' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    expect(idx.get(c.id)).toBeDefined()
    idx.removeById(c.id)
    expect(idx.get(c.id)).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- index-store`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/store/index.ts tests/integration/index-store.test.ts
git commit -m "feat(main): in-memory card index"
```

---

## Task 12: FSRS scheduler wrapper

**Files:**
- Create: `src/main/fsrs/scheduler.ts`
- Create: `tests/unit/scheduler.test.ts`

- [ ] **Step 1: Create `src/main/fsrs/scheduler.ts`**

```ts
import { FSRS, generatorParameters, Rating as FsrsRating, Card as FsrsCard, State as FsrsStateEnum } from 'ts-fsrs'
import type { ReviewState } from '../../shared/schema'
import type { Rating } from '../../shared/constants'

export type FsrsOptions = { desiredRetention?: number; maximumInterval?: number }

export function createScheduler(opts: FsrsOptions = {}): FSRS {
  const params = generatorParameters({
    request_retention: opts.desiredRetention ?? 0.9,
    maximum_interval: opts.maximumInterval ?? 36500
  })
  return new FSRS(params)
}

const stateMap: Record<ReviewState['state'], FsrsStateEnum> = {
  New: FsrsStateEnum.New,
  Learning: FsrsStateEnum.Learning,
  Review: FsrsStateEnum.Review,
  Relearning: FsrsStateEnum.Relearning
}
const reverseStateMap: Record<FsrsStateEnum, ReviewState['state']> = {
  [FsrsStateEnum.New]: 'New',
  [FsrsStateEnum.Learning]: 'Learning',
  [FsrsStateEnum.Review]: 'Review',
  [FsrsStateEnum.Relearning]: 'Relearning'
}
const ratingMap: Record<Rating, FsrsRating> = {
  Again: FsrsRating.Again,
  Hard: FsrsRating.Hard,
  Good: FsrsRating.Good,
  Easy: FsrsRating.Easy
}

function toFsrsCard(s: ReviewState): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: stateMap[s.state],
    last_review: s.last_review ? new Date(s.last_review) : undefined
  }
}

export function rateCard(
  scheduler: FSRS,
  state: ReviewState,
  rating: Rating,
  now: Date = new Date()
): ReviewState {
  const card = toFsrsCard(state)
  const result = scheduler.next(card, now, ratingMap[rating])
  const next = result.card
  return {
    id: state.id,
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: reverseStateMap[next.state],
    last_review: now.toISOString(),
    history: [
      ...state.history,
      { ts: now.toISOString(), rating, elapsed_days: state.elapsed_days }
    ]
  }
}
```

- [ ] **Step 2: Write test `tests/unit/scheduler.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createScheduler, rateCard } from '../../src/main/fsrs/scheduler'
import { newState } from '../../src/main/store/state'

describe('rateCard', () => {
  it('advances a new card after "Good" rating', () => {
    const sched = createScheduler()
    const initial = newState('c1')
    const now = new Date('2026-04-23T10:00:00Z')
    const next = rateCard(sched, initial, 'Good', now)
    expect(next.reps).toBe(1)
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime())
    expect(next.state).not.toBe('New')
    expect(next.history).toHaveLength(1)
    expect(next.history[0]!.rating).toBe('Good')
  })

  it('increments lapses after "Again" on a reviewed card', () => {
    const sched = createScheduler()
    const initial = rateCard(sched, newState('c2'), 'Good', new Date('2026-04-23T10:00:00Z'))
    const lapsed = rateCard(sched, initial, 'Again', new Date('2026-04-24T10:00:00Z'))
    expect(lapsed.lapses).toBeGreaterThanOrEqual(initial.lapses)
    expect(['Learning', 'Relearning']).toContain(lapsed.state)
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- scheduler`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/fsrs/scheduler.ts tests/unit/scheduler.test.ts
git commit -m "feat(main): FSRS scheduler wrapper"
```

---

## Task 13: Due-queue builder

**Files:**
- Create: `src/main/fsrs/queue.ts`
- Create: `tests/integration/queue.test.ts`

- [ ] **Step 1: Create `src/main/fsrs/queue.ts`**

```ts
import { readState } from '../store/state'
import type { CardMeta } from '../../shared/schema'
import type { CardIndex } from '../store/index'

export async function buildDueQueue(
  rootPath: string,
  index: CardIndex,
  opts: { namespaces?: string[]; now?: Date } = {}
): Promise<CardMeta[]> {
  const now = (opts.now ?? new Date()).getTime()
  const wantedPrefixes = opts.namespaces?.length ? opts.namespaces : null
  const result: Array<{ meta: CardMeta; due: number }> = []
  for (const meta of index.all()) {
    if (wantedPrefixes && !wantedPrefixes.some(p => meta.namespace === p || meta.namespace.startsWith(p + '/'))) continue
    const st = await readState(rootPath, meta.id)
    const due = new Date(st.due).getTime()
    if (due <= now) result.push({ meta, due })
  }
  return result.sort((a, b) => a.due - b.due).map(r => r.meta)
}
```

- [ ] **Step 2: Write test `tests/integration/queue.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createCardOnDisk } from '../../src/main/store/cards'
import { writeState, readState } from '../../src/main/store/state'
import { CardIndex } from '../../src/main/store/index'
import { buildDueQueue } from '../../src/main/fsrs/queue'

describe('buildDueQueue', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'q-'))
  })
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('includes cards whose due is in the past', async () => {
    const c1 = await createCardOnDisk(root, { namespace: 'a', question: 'Q1', body: 'B' })
    const c2 = await createCardOnDisk(root, { namespace: 'a', question: 'Q2', body: 'B' })
    await writeState(root, { ...(await readState(root, c1.id)), due: '2020-01-01T00:00:00.000Z' })
    await writeState(root, { ...(await readState(root, c2.id)), due: '2099-01-01T00:00:00.000Z' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    const q = await buildDueQueue(root, idx, { now: new Date('2026-04-23T00:00:00Z') })
    const ids = q.map(c => c.id)
    expect(ids).toContain(c1.id)
    expect(ids).not.toContain(c2.id)
  })

  it('filters by namespace prefix', async () => {
    const c1 = await createCardOnDisk(root, { namespace: 'system-design/caching', question: 'Q1', body: 'B' })
    const c2 = await createCardOnDisk(root, { namespace: 'concurrency', question: 'Q2', body: 'B' })
    await writeState(root, { ...(await readState(root, c1.id)), due: '2020-01-01T00:00:00.000Z' })
    await writeState(root, { ...(await readState(root, c2.id)), due: '2020-01-01T00:00:00.000Z' })
    const idx = new CardIndex()
    await idx.buildFrom(root)
    const q = await buildDueQueue(root, idx, { namespaces: ['system-design'], now: new Date() })
    expect(q.map(c => c.id)).toEqual([c1.id])
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- queue`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/fsrs/queue.ts tests/integration/queue.test.ts
git commit -m "feat(main): due-queue builder with namespace filter"
```

---

## Task 14: Filesystem watcher

**Files:**
- Create: `src/main/watcher.ts`

*(Watcher is tested end-to-end via the IPC layer. Isolated unit tests for chokidar are low-value here.)*

- [ ] **Step 1: Create `src/main/watcher.ts`**

```ts
import chokidar from 'chokidar'
import { EventEmitter } from 'node:events'
import { cardsDir, namespaceFromPath } from './paths'
import { readCardAtPath } from './store/cards'
import type { CardIndex } from './store/index'

export type WatcherEvents = {
  'card-added': string
  'card-changed': string
  'card-removed': string
}

export class Watcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher
  private suppressed = new Map<string, { mtime: number; hash: string }>()

  constructor(private rootPath: string, private index: CardIndex) { super() }

  start() {
    this.watcher = chokidar.watch(cardsDir(this.rootPath), {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
    })
    this.watcher.on('add', p => this.handleChange(p, 'add'))
    this.watcher.on('change', p => this.handleChange(p, 'change'))
    this.watcher.on('unlink', p => this.handleRemove(p))
  }

  suppressNext(path: string, mtime: number, hash: string) {
    this.suppressed.set(path, { mtime, hash })
  }

  async stop() { await this.watcher?.close() }

  private async handleChange(absPath: string, kind: 'add' | 'change') {
    if (!absPath.endsWith('.md')) return
    try {
      const full = await readCardAtPath(this.rootPath, absPath)
      const s = this.suppressed.get(absPath)
      if (s && s.mtime === full.mtime && s.hash === full.bodyHash) {
        this.suppressed.delete(absPath)
        return
      }
      const { body, ...meta } = full
      void body
      const prev = this.index.getByPath(absPath)
      this.index.upsert(meta)
      if (kind === 'add' || !prev) this.emit('card-added', meta.id)
      else this.emit('card-changed', meta.id)
    } catch (_err) {
      // corrupt frontmatter; ignore until fixed
    }
  }

  private handleRemove(absPath: string) {
    if (!absPath.endsWith('.md')) return
    const id = this.index.removeByPath(absPath)
    if (id) this.emit('card-removed', id)
    void namespaceFromPath
  }
}
```

- [ ] **Step 2: Smoke-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/watcher.ts
git commit -m "feat(main): filesystem watcher for card files"
```

---

## Task 15: External editor launcher

**Files:**
- Create: `src/main/editor-open.ts`

- [ ] **Step 1: Create `src/main/editor-open.ts`**

```ts
import { shell } from 'electron'
import { spawn } from 'node:child_process'

export async function openInExternalEditor(absPath: string, override: string | null): Promise<void> {
  if (override) {
    spawn(override, [absPath], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  await shell.openPath(absPath)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/editor-open.ts
git commit -m "feat(main): open card in external editor"
```

---

## Task 16: IPC registration

**Files:**
- Create: `src/main/ipc/register.ts`

- [ ] **Step 1: Create `src/main/ipc/register.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { z } from 'zod'
import { readCardAtPath, createCardOnDisk, updateCardOnDisk, moveCardOnDisk, deleteCardOnDisk } from '../store/cards'
import { readState, writeState, deleteState, listStateIds } from '../store/state'
import { createScheduler, rateCard } from '../fsrs/scheduler'
import { buildDueQueue } from '../fsrs/queue'
import { openInExternalEditor } from '../editor-open'
import { loadConfig, patchConfig } from '../store/config'
import { configPath } from '../paths'
import type { Config } from '../../shared/schema'
import type { CardIndex } from '../store/index'
import type { Watcher } from '../watcher'
import type { ApiResult, NamespaceNode, DashboardData } from '../../shared/api'
import type { WidgetId } from '../../shared/constants'
import { RATINGS, WIDGET_IDS } from '../../shared/constants'
import { hashBody } from '../atomic-write'

type Ctx = {
  getConfig: () => Config
  setConfig: (cfg: Config) => void
  index: CardIndex
  watcher: Watcher
  win: BrowserWindow
}

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const err = (e: unknown): ApiResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) })

function namespacesFromIndex(index: CardIndex, dueCountsByNs: Map<string, number>): NamespaceNode {
  const root: NamespaceNode = { name: '', path: '', dueCount: 0, children: [] }
  for (const meta of index.all()) {
    const parts = meta.namespace ? meta.namespace.split('/') : []
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!
      const nsPath = parts.slice(0, i + 1).join('/')
      let child = cur.children.find(c => c.name === name)
      if (!child) { child = { name, path: nsPath, dueCount: 0, children: [] }; cur.children.push(child) }
      cur = child
    }
  }
  const fillCounts = (n: NamespaceNode): number => {
    let total = dueCountsByNs.get(n.path) ?? 0
    for (const child of n.children) total += fillCounts(child)
    n.dueCount = total
    return total
  }
  fillCounts(root)
  return root
}

export function registerIpc(ctx: Ctx): () => void {
  const h = <T, A = void>(channel: string, schema: z.ZodType<A>, fn: (args: A) => Promise<T> | T) => {
    ipcMain.handle(channel, async (_e, raw) => {
      try {
        const args = schema.parse(raw)
        return ok(await fn(args))
      } catch (e) { return err(e) }
    })
  }
  const VOID = z.undefined().or(z.null()).transform(() => undefined)

  h('listNamespaces', VOID, async () => {
    const rootPath = ctx.getConfig().rootPath
    const counts = new Map<string, number>()
    const due = await buildDueQueue(rootPath, ctx.index)
    for (const m of due) counts.set(m.namespace, (counts.get(m.namespace) ?? 0) + 1)
    return namespacesFromIndex(ctx.index, counts)
  })

  h('listCards', z.string().optional(), async (ns) => {
    return ctx.index.all().filter(m => !ns || m.namespace === ns || m.namespace.startsWith(ns + '/'))
  })

  h('getDueQueue', z.object({ namespaces: z.array(z.string()).optional() }), async (f) => {
    return buildDueQueue(ctx.getConfig().rootPath, ctx.index, { namespaces: f.namespaces })
  })

  h('readCard', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    return readCardAtPath(ctx.getConfig().rootPath, meta.path)
  })

  h('createCard', z.object({
    namespace: z.string(),
    question: z.string().min(1),
    body: z.string(),
    tags: z.array(z.string()).optional()
  }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const full = await createCardOnDisk(rootPath, input)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...meta } = full; void _b
    ctx.index.upsert(meta)
    return full
  })

  h('updateCard', z.object({
    id: z.string(),
    question: z.string().optional(),
    body: z.string().optional(),
    tags: z.array(z.string()).optional()
  }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const meta = ctx.index.get(input.id)
    if (!meta) throw new Error(`Card not found: ${input.id}`)
    await updateCardOnDisk(meta.path, input)
    const full = await readCardAtPath(rootPath, meta.path)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...nextMeta } = full; void _b
    ctx.index.upsert(nextMeta)
    return full
  })

  h('moveCard', z.object({ id: z.string(), namespace: z.string() }), async (input) => {
    const rootPath = ctx.getConfig().rootPath
    const meta = ctx.index.get(input.id)
    if (!meta) throw new Error(`Card not found: ${input.id}`)
    const newPath = await moveCardOnDisk(rootPath, meta.path, input.namespace)
    const full = await readCardAtPath(rootPath, newPath)
    ctx.watcher.suppressNext(full.path, full.mtime, full.bodyHash)
    const { body: _b, ...nextMeta } = full; void _b
    ctx.index.upsert(nextMeta)
    return full
  })

  h('deleteCard', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    await deleteCardOnDisk(meta.path)
    await deleteState(ctx.getConfig().rootPath, id)
    ctx.index.removeById(id)
  })

  h('rateReview', z.object({ id: z.string(), rating: z.enum(RATINGS) }), async (input) => {
    const cfg = ctx.getConfig()
    const scheduler = createScheduler(cfg.fsrs)
    const current = await readState(cfg.rootPath, input.id)
    const next = rateCard(scheduler, current, input.rating)
    await writeState(cfg.rootPath, next)
    return next
  })

  h('openInExternalEditor', z.string(), async (id) => {
    const meta = ctx.index.get(id)
    if (!meta) throw new Error(`Card not found: ${id}`)
    await openInExternalEditor(meta.path, ctx.getConfig().externalEditor)
  })

  h('getConfig', VOID, async () => ctx.getConfig())
  h('updateConfig', z.record(z.any()), async (patch) => {
    const next = await patchConfig(configPath(), ctx.getConfig(), patch as Partial<Config>)
    ctx.setConfig(next)
    return next
  })

  h('searchCards', z.string(), async (q) => {
    const lc = q.toLowerCase()
    return ctx.index.all().filter(m => m.question.toLowerCase().includes(lc) || m.tags.some(t => t.toLowerCase().includes(lc)))
  })

  h('rescan', VOID, async () => {
    await ctx.index.buildFrom(ctx.getConfig().rootPath)
    ctx.win.webContents.send('index-rebuilt')
  })

  h('getDashboardData', z.array(z.enum(WIDGET_IDS)), async (widgets) => {
    return computeDashboard(ctx, widgets)
  })

  const onAdded = (id: string) => ctx.win.webContents.send('card-added', id)
  const onChanged = (id: string) => ctx.win.webContents.send('card-changed', id)
  const onRemoved = (id: string) => ctx.win.webContents.send('card-removed', id)
  ctx.watcher.on('card-added', onAdded)
  ctx.watcher.on('card-changed', onChanged)
  ctx.watcher.on('card-removed', onRemoved)

  // Orphan state cleanup on startup
  listStateIds(ctx.getConfig().rootPath).then(ids => {
    for (const id of ids) if (!ctx.index.get(id)) deleteState(ctx.getConfig().rootPath, id)
  })

  return () => {
    ctx.watcher.off('card-added', onAdded)
    ctx.watcher.off('card-changed', onChanged)
    ctx.watcher.off('card-removed', onRemoved)
    for (const ch of [
      'listNamespaces','listCards','getDueQueue','readCard','createCard','updateCard',
      'moveCard','deleteCard','rateReview','openInExternalEditor','getConfig','updateConfig',
      'searchCards','rescan','getDashboardData'
    ]) ipcMain.removeHandler(ch)
  }
}

async function computeDashboard(ctx: Ctx, widgets: WidgetId[]): Promise<DashboardData> {
  const cfg = ctx.getConfig()
  const rootPath = cfg.rootPath
  const all = ctx.index.all()
  const states = await Promise.all(all.map(async m => ({ meta: m, state: await readState(rootPath, m.id) })))
  const result: DashboardData = {}

  const dayKey = (d: Date) => d.toISOString().slice(0, 10)

  if (widgets.includes('due-forecast')) {
    const now = Date.now()
    const todayKey = dayKey(new Date())
    const next7: number[] = Array(7).fill(0)
    let today = 0
    for (const { state } of states) {
      const due = new Date(state.due).getTime()
      const diffDays = Math.floor((due - now) / 86_400_000)
      if (due <= now || dayKey(new Date(due)) === todayKey) today++
      else if (diffDays >= 0 && diffDays < 7) next7[diffDays]! += 1
    }
    result.dueForecast = { today, next7Days: next7 }
  }

  if (widgets.includes('namespace-ranking')) {
    const byNs = new Map<string, { total: number; reps: number; sumRetention: number; count: number }>()
    for (const { meta, state } of states) {
      const k = meta.namespace || '(root)'
      const r = retention(state)
      const cur = byNs.get(k) ?? { total: 0, reps: 0, sumRetention: 0, count: 0 }
      cur.total++; cur.reps += state.reps; cur.sumRetention += r; cur.count++
      byNs.set(k, cur)
    }
    result.namespaceRanking = Array.from(byNs.entries())
      .map(([namespace, v]) => ({ namespace, retention: v.count ? v.sumRetention / v.count : 0, count: v.total }))
      .sort((a, b) => a.retention - b.retention)
  }

  if (widgets.includes('leech-list')) {
    result.leechList = states
      .filter(s => s.state.lapses >= 1)
      .sort((a, b) => b.state.lapses - a.state.lapses)
      .slice(0, 10)
      .map(({ meta, state }) => ({ id: meta.id, question: meta.question, lapses: state.lapses, namespace: meta.namespace }))
  }

  if (widgets.includes('heatmap')) {
    result.heatmap = states.map(({ meta, state }) => ({
      id: meta.id, question: meta.question, retention: retention(state), namespace: meta.namespace
    }))
  }

  if (widgets.includes('activity-streak')) {
    const byDay = new Map<string, number>()
    for (const { state } of states) for (const h of state.history) {
      const k = h.ts.slice(0, 10)
      byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    const days: Array<{ date: string; count: number }> = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      const k = dayKey(d)
      days.push({ date: k, count: byDay.get(k) ?? 0 })
    }
    let streak = 0
    for (let i = days.length - 1; i >= 0; i--) { if (days[i]!.count > 0) streak++; else break }
    const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0)
    result.activityStreak = { days, currentStreak: streak, total }
  }

  if (widgets.includes('key-stats')) {
    const total = states.length
    const retentions = states.map(s => retention(s.state))
    const avg = retentions.length ? retentions.reduce((a, b) => a + b, 0) / retentions.length : 0
    const struggling = states.filter(s => s.state.lapses >= 3 || s.state.state === 'Relearning').length
    const mastered = states.filter(s => s.state.stability >= 30 && s.state.reps >= 4).length
    result.keyStats = { total, retention: avg, struggling, mastered }
  }

  void hashBody
  return result
}

function retention(s: ReturnType<typeof newStateSig>): number {
  if (s.reps === 0) return 0
  const retries = s.history.filter(h => h.rating === 'Again').length
  return Math.max(0, Math.min(1, 1 - retries / Math.max(1, s.history.length)))
}

// Type-only helper to satisfy the retention() signature without importing ReviewState twice
type newStateSig = { reps: number; history: Array<{ rating: string }> }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If TypeScript complains about the `newStateSig` helper, replace the two retention-related lines with `import type { ReviewState } from '../../shared/schema'` and type the parameter as `ReviewState`.)

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc
git commit -m "feat(main): register typed IPC handlers"
```

---

## Task 17: Main entry wiring

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Replace `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './store/config'
import { CardIndex } from './store/index'
import { Watcher } from './watcher'
import { registerIpc } from './ipc/register'
import { configPath, defaultRootPath } from './paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  let config = await loadConfig(configPath(), defaultRootPath())
  const index = new CardIndex()
  await index.buildFrom(config.rootPath)
  const watcher = new Watcher(config.rootPath, index)
  watcher.start()

  registerIpc({
    getConfig: () => config,
    setConfig: (c) => { config = c },
    index,
    watcher,
    win
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

- [ ] **Step 2: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(main): wire config, index, watcher, and IPC"
```

---

## Task 18: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Replace `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const invoke = <T>(ch: string, args?: unknown): Promise<T> => ipcRenderer.invoke(ch, args ?? null) as Promise<T>
const on = (ch: string, cb: (...a: any[]) => void) => {
  const handler = (_e: unknown, ...args: any[]) => cb(...args)
  ipcRenderer.on(ch, handler)
  return () => ipcRenderer.off(ch, handler)
}

const api: Api = {
  listNamespaces: () => invoke('listNamespaces'),
  listCards: (namespace) => invoke('listCards', namespace),
  getDueQueue: (filter) => invoke('getDueQueue', filter),
  readCard: (id) => invoke('readCard', id),
  getDashboardData: (widgets) => invoke('getDashboardData', widgets),
  createCard: (input) => invoke('createCard', input),
  updateCard: (input) => invoke('updateCard', input),
  moveCard: (input) => invoke('moveCard', input),
  deleteCard: (id) => invoke('deleteCard', id),
  rateReview: (input) => invoke('rateReview', input),
  openInExternalEditor: (id) => invoke('openInExternalEditor', id),
  getConfig: () => invoke('getConfig'),
  updateConfig: (patch) => invoke('updateConfig', patch),
  searchCards: (q) => invoke('searchCards', q),
  rescan: () => invoke('rescan'),
  onCardChanged: (cb) => on('card-changed', cb),
  onCardAdded: (cb) => on('card-added', cb),
  onCardRemoved: (cb) => on('card-removed', cb),
  onIndexRebuilt: (cb) => on('index-rebuilt', cb)
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 2: Verify app boots**

Run: `npm run dev`
Expected: Electron window opens; no uncaught errors in devtools; `window.api` is defined (check in devtools console).

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): expose typed api to renderer"
```

---

## Task 19: Renderer store (Zustand)

**Files:**
- Create: `src/renderer/stores/app-store.ts`
- Create: `src/renderer/lib/api.ts`

- [ ] **Step 1: Create `src/renderer/lib/api.ts`**

```ts
import type { ApiResult } from '../../shared/api'

export async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}
```

- [ ] **Step 2: Create `src/renderer/stores/app-store.ts`**

```ts
import { create } from 'zustand'
import type { Config } from '../../shared/schema'
import type { NamespaceNode } from '../../shared/api'
import { unwrap } from '../lib/api'

type AppState = {
  config: Config | null
  namespaces: NamespaceNode | null
  selectedNamespaces: string[]
  theme: 'system' | 'light' | 'dark'
  init(): Promise<void>
  refreshNamespaces(): Promise<void>
  setSelectedNamespaces(ns: string[]): void
  setTheme(theme: 'system' | 'light' | 'dark'): Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  namespaces: null,
  selectedNamespaces: [],
  theme: 'system',
  async init() {
    const config = await unwrap(window.api.getConfig())
    const namespaces = await unwrap(window.api.listNamespaces())
    set({ config, namespaces, theme: config.theme })
    window.api.onCardAdded(() => get().refreshNamespaces())
    window.api.onCardRemoved(() => get().refreshNamespaces())
    window.api.onCardChanged(() => get().refreshNamespaces())
  },
  async refreshNamespaces() {
    const namespaces = await unwrap(window.api.listNamespaces())
    set({ namespaces })
  },
  setSelectedNamespaces(ns) { set({ selectedNamespaces: ns }) },
  async setTheme(theme) {
    const cfg = await unwrap(window.api.updateConfig({ theme }))
    set({ config: cfg, theme })
  }
}))
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores src/renderer/lib
git commit -m "feat(renderer): Zustand store and api helpers"
```

---

## Task 20: App shell, router, theme

**Files:**
- Create: `src/renderer/components/sidebar.tsx`
- Create: `src/renderer/components/namespace-tree.tsx`
- Create: `src/renderer/components/theme-toggle.tsx`
- Modify: `src/renderer/app.tsx`

- [ ] **Step 1: Create `src/renderer/components/theme-toggle.tsx`**

```tsx
import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore()
  useEffect(() => {
    const apply = (t: string) => {
      const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => theme === 'system' && apply('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'
  return (
    <button onClick={() => setTheme(next)} className="text-xs text-muted hover:text-fg px-2 py-1 rounded border border-border">
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Create `src/renderer/components/namespace-tree.tsx`**

```tsx
import type { NamespaceNode } from '../../shared/api'
import { useAppStore } from '../stores/app-store'

function NodeRow({ node, depth }: { node: NamespaceNode; depth: number }) {
  const { selectedNamespaces, setSelectedNamespaces } = useAppStore()
  const checked = selectedNamespaces.includes(node.path)
  const toggle = () => {
    if (!node.path) return
    setSelectedNamespaces(
      checked ? selectedNamespaces.filter(n => n !== node.path) : [...selectedNamespaces, node.path]
    )
  }
  return (
    <div>
      {node.path !== '' && (
        <label className="flex items-center gap-2 px-2 py-0.5 text-sm hover:bg-border/40 rounded cursor-pointer" style={{ paddingLeft: 8 + depth * 12 }}>
          <input type="checkbox" checked={checked} onChange={toggle} className="accent-accent" />
          <span className="flex-1">{node.name}</span>
          {node.dueCount > 0 && <span className="text-xs text-muted">{node.dueCount}</span>}
        </label>
      )}
      {node.children.map(c => <NodeRow key={c.path} node={c} depth={depth + (node.path ? 1 : 0)} />)}
    </div>
  )
}

export function NamespaceTree() {
  const { namespaces } = useAppStore()
  if (!namespaces) return null
  if (namespaces.children.length === 0) {
    return <div className="text-xs text-muted px-2 py-4">No cards yet. Press ⌘N to create one.</div>
  }
  return <div><NodeRow node={namespaces} depth={0} /></div>
}
```

- [ ] **Step 3: Create `src/renderer/components/sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { NamespaceTree } from './namespace-tree'
import { ThemeToggle } from './theme-toggle'

export function Sidebar() {
  const links = [
    { to: '/review',    label: 'Review' },
    { to: '/browse',    label: 'Browse' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/settings',  label: 'Settings' }
  ]
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg flex flex-col h-full">
      <div className="px-4 py-3 font-semibold">Interview Prep</div>
      <nav className="px-2">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `block px-2 py-1.5 text-sm rounded ${isActive ? 'bg-border/60 text-fg' : 'text-muted hover:text-fg hover:bg-border/30'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted mt-4">Namespaces</div>
      <div className="flex-1 overflow-auto px-1"><NamespaceTree /></div>
      <div className="p-3 border-t border-border flex justify-between items-center">
        <NavLink to="/editor/new" className="text-sm text-accent hover:underline">+ New card</NavLink>
        <ThemeToggle />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Replace `src/renderer/app.tsx`**

```tsx
import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/sidebar'
import { useAppStore } from './stores/app-store'
import { ReviewRoute } from './routes/review'
import { BrowseRoute } from './routes/browse'
import { EditorRoute } from './routes/editor'
import { DashboardRoute } from './routes/dashboard'
import { SettingsRoute } from './routes/settings'

export function App() {
  const { config, init } = useAppStore()
  useEffect(() => { init() }, [init])
  if (!config) return <div className="p-6 text-muted">Loading…</div>
  return (
    <HashRouter>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"           element={<Navigate to="/review" />} />
            <Route path="/review"     element={<ReviewRoute />} />
            <Route path="/browse"     element={<BrowseRoute />} />
            <Route path="/editor/new" element={<EditorRoute mode="new" />} />
            <Route path="/editor/:id" element={<EditorRoute mode="edit" />} />
            <Route path="/dashboard"  element={<DashboardRoute />} />
            <Route path="/settings"   element={<SettingsRoute />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
```

- [ ] **Step 5: Create stub route files**

Create `src/renderer/routes/review.tsx`:
```tsx
export function ReviewRoute() { return <div className="p-6">Review</div> }
```
Create `src/renderer/routes/browse.tsx`:
```tsx
export function BrowseRoute() { return <div className="p-6">Browse</div> }
```
Create `src/renderer/routes/editor.tsx`:
```tsx
export function EditorRoute(_props: { mode: 'new' | 'edit' }) { void _props; return <div className="p-6">Editor</div> }
```
Create `src/renderer/routes/dashboard.tsx`:
```tsx
export function DashboardRoute() { return <div className="p-6">Dashboard</div> }
```
Create `src/renderer/routes/settings.tsx`:
```tsx
export function SettingsRoute() { return <div className="p-6">Settings</div> }
```

- [ ] **Step 6: Verify**

Run: `npm run dev`
Expected: sidebar renders; each nav link shows the stub content; theme toggle switches dark/light; "No cards yet" shown in namespaces.

- [ ] **Step 7: Commit**

```bash
git add src/renderer
git commit -m "feat(renderer): app shell, router, sidebar, theme toggle"
```

---

## Task 21: Markdown view component (Shiki + remark)

**Files:**
- Create: `src/renderer/components/markdown-view.tsx`

- [ ] **Step 1: Create `src/renderer/components/markdown-view.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeReact, { type Options } from 'rehype-react'
import * as prod from 'react/jsx-runtime'
import { getHighlighter } from 'shiki'

const reactOpts: Options = { jsx: prod.jsx, jsxs: prod.jsxs, Fragment: prod.Fragment }
let highlighterPromise: ReturnType<typeof getHighlighter> | null = null
function getSharedHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({ themes: ['github-light', 'github-dark'], langs: ['ts', 'tsx', 'js', 'python', 'go', 'rust', 'bash', 'json', 'sql', 'yaml', 'md'] })
  }
  return highlighterPromise
}

export function MarkdownView({ content }: { content: string }) {
  const [node, setNode] = useState<React.ReactNode>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const hl = await getSharedHighlighter()
      const file = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: false })
        .use(rehypeReact, {
          ...reactOpts,
          components: {
            code: ({ className, children, ...rest }: any) => {
              const match = /language-(\w+)/.exec(className ?? '')
              if (!match) return <code className={className} {...rest}>{children}</code>
              const lang = match[1]
              const theme = document.documentElement.classList.contains('dark') ? 'github-dark' : 'github-light'
              const html = hl.codeToHtml(String(children).replace(/\n$/, ''), { lang, theme })
              return <div dangerouslySetInnerHTML={{ __html: html }} />
            }
          }
        })
        .process(content)
      if (!cancelled) setNode(file.result as React.ReactNode)
    })()
    return () => { cancelled = true }
  }, [content])
  return <div className="prose max-w-none font-serif text-[17px] leading-relaxed">{node}</div>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/markdown-view.tsx
git commit -m "feat(renderer): markdown view with Shiki syntax highlighting"
```

---

## Task 22: Review route

**Files:**
- Modify: `src/renderer/routes/review.tsx`

- [ ] **Step 1: Replace `src/renderer/routes/review.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardFull, CardMeta } from '../../shared/schema'
import type { Rating } from '../../shared/constants'
import { RATINGS } from '../../shared/constants'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'
import { MarkdownView } from '../components/markdown-view'

export function ReviewRoute() {
  const navigate = useNavigate()
  const { selectedNamespaces } = useAppStore()
  const [queue, setQueue] = useState<CardMeta[]>([])
  const [current, setCurrent] = useState<CardFull | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [sessionCounts, setSessionCounts] = useState({ reviewed: 0, again: 0 })

  const loadQueue = useCallback(async () => {
    const q = await unwrap(window.api.getDueQueue({ namespaces: selectedNamespaces }))
    setQueue(q)
  }, [selectedNamespaces])

  useEffect(() => { loadQueue() }, [loadQueue])

  useEffect(() => {
    if (!queue.length) { setCurrent(null); return }
    const first = queue[0]!
    unwrap(window.api.readCard(first.id)).then(setCurrent)
    setRevealed(false)
  }, [queue])

  const rate = useCallback(async (rating: Rating) => {
    if (!current) return
    await unwrap(window.api.rateReview({ id: current.id, rating }))
    setSessionCounts(c => ({ reviewed: c.reviewed + 1, again: c.again + (rating === 'Again' ? 1 : 0) }))
    setQueue(q => q.slice(1))
  }, [current])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return
      if (e.key === ' ') { e.preventDefault(); setRevealed(true); return }
      if (e.key === 'e' || e.key === 'E') { navigate(`/editor/${current.id}`); return }
      if (!revealed) return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) { rate(RATINGS[n - 1]!) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate, navigate])

  const breadcrumb = useMemo(() => current?.namespace.split('/').join(' / ') ?? '', [current])

  if (!current) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold">No cards due.</h2>
        <p className="text-muted mt-2">
          {sessionCounts.reviewed > 0
            ? `Session: ${sessionCounts.reviewed} reviewed · ${sessionCounts.again} again.`
            : 'Create a card or adjust your namespace filters.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-10">
      <div className="text-xs uppercase tracking-wider text-muted mb-2">{breadcrumb || 'root'}</div>
      <h1 className="text-2xl font-serif font-semibold mb-8 leading-tight">{current.question}</h1>
      {revealed ? (
        <>
          <MarkdownView content={current.body} />
          <div className="mt-10 flex gap-2">
            {RATINGS.map((r, i) => (
              <button
                key={r}
                onClick={() => rate(r)}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-border/40"
              >
                <span className="text-muted mr-2">{i + 1}</span>{r}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="px-4 py-2 border border-border rounded text-sm hover:bg-border/40"
        >
          Reveal answer (Space)
        </button>
      )}
      <div className="mt-12 text-xs text-muted">
        {queue.length} cards in queue · Session: {sessionCounts.reviewed} reviewed, {sessionCounts.again} again
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`.
Manually create one card via the filesystem (or wait for the editor route) — for now just verify the "No cards due" state renders.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/review.tsx
git commit -m "feat(renderer): review route with keyboard shortcuts"
```

---

## Task 23: Editor route

**Files:**
- Create: `src/renderer/components/codemirror-editor.tsx`
- Modify: `src/renderer/routes/editor.tsx`

- [ ] **Step 1: Install CodeMirror deps**

```bash
npm install @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/commands @codemirror/language @codemirror/search
```

- [ ] **Step 2: Create `src/renderer/components/codemirror-editor.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

export function CodeMirrorEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          markdown(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of(u => { if (u.docChanged) onChange(u.state.doc.toString()) })
        ]
      })
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={hostRef} className="h-full" />
}
```

- [ ] **Step 3: Replace `src/renderer/routes/editor.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CodeMirrorEditor } from '../components/codemirror-editor'
import { MarkdownView } from '../components/markdown-view'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

export function EditorRoute({ mode }: { mode: 'new' | 'edit' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [qs] = useSearchParams()
  const { refreshNamespaces } = useAppStore()
  const [question, setQuestion] = useState('')
  const [namespace, setNamespace] = useState(qs.get('ns') ?? '')
  const [tags, setTags] = useState('')
  const [body, setBody] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (mode === 'edit' && id) {
      unwrap(window.api.readCard(id)).then(c => {
        setQuestion(c.question); setNamespace(c.namespace); setTags(c.tags.join(', ')); setBody(c.body)
        setLoadedId(c.id)
      })
    }
  }, [mode, id])

  const save = async () => {
    const tagsArr = tags.split(',').map(s => s.trim()).filter(Boolean)
    if (mode === 'new' || !loadedId) {
      if (!question.trim()) { setStatus('Question required'); return }
      const created = await unwrap(window.api.createCard({ namespace, question, body, tags: tagsArr }))
      setLoadedId(created.id)
      setStatus('Saved')
      await refreshNamespaces()
      navigate(`/editor/${created.id}`, { replace: true })
      return
    }
    await unwrap(window.api.updateCard({ id: loadedId, question, body, tags: tagsArr }))
    // handle namespace move separately
    const fresh = await unwrap(window.api.readCard(loadedId))
    if (fresh.namespace !== namespace) {
      await unwrap(window.api.moveCard({ id: loadedId, namespace }))
      await refreshNamespaces()
    }
    setStatus('Saved')
  }

  const scheduleAutosave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { save() }, 2000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, namespace, tags, body, loadedId])

  const openExternal = async () => {
    if (!loadedId) return
    await unwrap(window.api.openInExternalEditor(loadedId))
  }

  const previewBody = useMemo(() => body, [body])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-3 flex gap-2 items-center">
        <input
          className="flex-1 bg-transparent text-lg font-serif font-medium focus:outline-none"
          placeholder="Question…"
          value={question}
          onChange={e => { setQuestion(e.target.value); scheduleAutosave() }}
        />
        <input
          className="w-56 bg-transparent text-sm border border-border rounded px-2 py-1"
          placeholder="namespace (e.g. system-design/caching)"
          value={namespace}
          onChange={e => { setNamespace(e.target.value); scheduleAutosave() }}
        />
        <input
          className="w-48 bg-transparent text-sm border border-border rounded px-2 py-1"
          placeholder="tags, comma separated"
          value={tags}
          onChange={e => { setTags(e.target.value); scheduleAutosave() }}
        />
        <button onClick={save} className="text-sm border border-border rounded px-3 py-1 hover:bg-border/40">Save</button>
        <button onClick={openExternal} disabled={!loadedId} className="text-sm border border-border rounded px-3 py-1 hover:bg-border/40 disabled:opacity-50">Open externally</button>
        <span className="text-xs text-muted">{status}</span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-border">
          <CodeMirrorEditor value={body} onChange={(v) => { setBody(v); scheduleAutosave() }} />
        </div>
        <div className="flex-1 overflow-auto p-6">
          <MarkdownView content={previewBody} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`.
Create a new card from the sidebar (+ New card). Fill question, namespace, body. Save. Navigate to `/review` — card should appear in queue immediately.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/codemirror-editor.tsx src/renderer/routes/editor.tsx package.json package-lock.json
git commit -m "feat(renderer): editor route with CodeMirror and live preview"
```

---

## Task 24: Browse route

**Files:**
- Modify: `src/renderer/routes/browse.tsx`

- [ ] **Step 1: Replace `src/renderer/routes/browse.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CardMeta } from '../../shared/schema'
import { unwrap } from '../lib/api'
import { useAppStore } from '../stores/app-store'

export function BrowseRoute() {
  const navigate = useNavigate()
  const { selectedNamespaces } = useAppStore()
  const [rows, setRows] = useState<CardMeta[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    unwrap(window.api.listCards()).then(setRows)
  }, [])

  const filtered = useMemo(() => {
    const lc = query.toLowerCase().trim()
    return rows.filter(r => {
      if (selectedNamespaces.length && !selectedNamespaces.some(ns => r.namespace === ns || r.namespace.startsWith(ns + '/'))) return false
      if (!lc) return true
      return r.question.toLowerCase().includes(lc) || r.tags.some(t => t.toLowerCase().includes(lc))
    })
  }, [rows, query, selectedNamespaces])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search questions or tags…"
          className="flex-1 bg-transparent border border-border rounded px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted">{filtered.length} of {rows.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted border-b border-border">
          <tr><th className="py-2 pr-4">Question</th><th className="pr-4">Namespace</th><th className="pr-4">Tags</th></tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id} onClick={() => navigate(`/editor/${r.id}`)} className="cursor-pointer hover:bg-border/30 border-b border-border/60">
              <td className="py-2 pr-4 font-serif">{r.question}</td>
              <td className="pr-4 text-muted">{r.namespace || '—'}</td>
              <td className="pr-4 text-muted">{r.tags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`. Browse lists cards; searching filters; clicking opens editor.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/routes/browse.tsx
git commit -m "feat(renderer): browse route with search and namespace filters"
```

---

## Task 25: Dashboard route + widgets

**Files:**
- Create: `src/renderer/components/widgets/due-forecast.tsx`
- Create: `src/renderer/components/widgets/namespace-ranking.tsx`
- Create: `src/renderer/components/widgets/leech-list.tsx`
- Create: `src/renderer/components/widgets/heatmap.tsx`
- Create: `src/renderer/components/widgets/activity-streak.tsx`
- Create: `src/renderer/components/widgets/key-stats.tsx`
- Modify: `src/renderer/routes/dashboard.tsx`

- [ ] **Step 1: Create the six widgets**

`src/renderer/components/widgets/due-forecast.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
export function DueForecastWidget({ data }: { data: NonNullable<DashboardData['dueForecast']> }) {
  const max = Math.max(1, data.today, ...data.next7Days)
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-2">Due today + 7-day forecast</div>
      <div className="text-3xl font-semibold mb-3">{data.today}<span className="text-xs text-muted ml-2">due today</span></div>
      <div className="flex items-end gap-1 h-20">
        {data.next7Days.map((c, i) => (
          <div key={i} className="flex-1 bg-accent/70 rounded-t" style={{ height: `${(c / max) * 100}%` }} title={`+${i}d: ${c}`} />
        ))}
      </div>
    </div>
  )
}
```

`src/renderer/components/widgets/namespace-ranking.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
export function NamespaceRankingWidget({ data }: { data: NonNullable<DashboardData['namespaceRanking']> }) {
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Weakest namespaces</div>
      <div className="flex flex-col gap-2">
        {data.slice(0, 6).map(row => (
          <div key={row.namespace}>
            <div className="flex justify-between text-xs"><span>{row.namespace}</span><span className="text-muted">{Math.round(row.retention * 100)}% · {row.count}</span></div>
            <div className="h-1.5 bg-border/60 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-accent" style={{ width: `${Math.round(row.retention * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

`src/renderer/components/widgets/leech-list.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
export function LeechListWidget({ data }: { data: NonNullable<DashboardData['leechList']> }) {
  const navigate = useNavigate()
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Leech list</div>
      <div className="flex flex-col gap-1">
        {data.map(c => (
          <div key={c.id} onClick={() => navigate(`/editor/${c.id}`)} className="flex justify-between text-xs py-1 px-2 hover:bg-border/40 rounded cursor-pointer">
            <span className="truncate">{c.question}</span>
            <span className="text-muted ml-2">{c.lapses} fails</span>
          </div>
        ))}
        {data.length === 0 && <div className="text-xs text-muted">No leeches yet.</div>}
      </div>
    </div>
  )
}
```

`src/renderer/components/widgets/heatmap.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
import { useNavigate } from 'react-router-dom'
export function HeatmapWidget({ data }: { data: NonNullable<DashboardData['heatmap']> }) {
  const navigate = useNavigate()
  const color = (r: number) => {
    if (r > 0.85) return 'bg-emerald-600'
    if (r > 0.65) return 'bg-emerald-400'
    if (r > 0.45) return 'bg-amber-400'
    return 'bg-rose-500'
  }
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Topic heatmap</div>
      <div className="flex flex-wrap gap-1">
        {data.map(c => (
          <div key={c.id} onClick={() => navigate(`/editor/${c.id}`)}
               title={`${c.question} · ${Math.round(c.retention * 100)}%`}
               className={`w-4 h-4 rounded cursor-pointer ${color(c.retention)}`} />
        ))}
      </div>
    </div>
  )
}
```

`src/renderer/components/widgets/activity-streak.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
export function ActivityStreakWidget({ data }: { data: NonNullable<DashboardData['activityStreak']> }) {
  const max = Math.max(1, ...data.days.map(d => d.count))
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Last 90 days</div>
      <div className="grid grid-flow-col grid-rows-7 gap-[2px] mb-3">
        {data.days.map(d => (
          <div key={d.date} title={`${d.date}: ${d.count}`}
               className="w-3 h-3 rounded-sm"
               style={{ background: d.count === 0 ? 'rgb(var(--border))' : `rgba(46,125,91,${0.25 + (d.count / max) * 0.75})` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span>🔥 {data.currentStreak}-day streak</span>
        <span className="text-muted">{data.total} reviews</span>
      </div>
    </div>
  )
}
```

`src/renderer/components/widgets/key-stats.tsx`:
```tsx
import type { DashboardData } from '../../../shared/api'
export function KeyStatsWidget({ data }: { data: NonNullable<DashboardData['keyStats']> }) {
  return (
    <div className="p-4 border border-border rounded bg-bg">
      <div className="text-sm font-semibold mb-3">Key stats</div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-2xl font-semibold">{data.total}</div><div className="text-xs text-muted">Total</div></div>
        <div><div className="text-2xl font-semibold">{Math.round(data.retention * 100)}%</div><div className="text-xs text-muted">Retention</div></div>
        <div><div className="text-2xl font-semibold">{data.struggling}</div><div className="text-xs text-muted">Struggling</div></div>
        <div><div className="text-2xl font-semibold">{data.mastered}</div><div className="text-xs text-muted">Mastered</div></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/renderer/routes/dashboard.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { DashboardData } from '../../shared/api'
import type { WidgetId } from '../../shared/constants'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'
import { DueForecastWidget } from '../components/widgets/due-forecast'
import { NamespaceRankingWidget } from '../components/widgets/namespace-ranking'
import { LeechListWidget } from '../components/widgets/leech-list'
import { HeatmapWidget } from '../components/widgets/heatmap'
import { ActivityStreakWidget } from '../components/widgets/activity-streak'
import { KeyStatsWidget } from '../components/widgets/key-stats'

export function DashboardRoute() {
  const { config } = useAppStore()
  const [data, setData] = useState<DashboardData | null>(null)

  const enabled: WidgetId[] = useMemo(() => {
    if (!config) return []
    return config.dashboard.widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order).map(w => w.id)
  }, [config])

  useEffect(() => {
    if (!enabled.length) { setData({}); return }
    unwrap(window.api.getDashboardData(enabled)).then(setData)
  }, [enabled])

  if (!data) return <div className="p-6 text-muted">Loading dashboard…</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enabled.map(id => {
          switch (id) {
            case 'due-forecast':      return data.dueForecast      && <DueForecastWidget      key={id} data={data.dueForecast} />
            case 'namespace-ranking': return data.namespaceRanking && <NamespaceRankingWidget key={id} data={data.namespaceRanking} />
            case 'leech-list':        return data.leechList        && <LeechListWidget        key={id} data={data.leechList} />
            case 'heatmap':           return data.heatmap          && <HeatmapWidget          key={id} data={data.heatmap} />
            case 'activity-streak':   return data.activityStreak   && <ActivityStreakWidget   key={id} data={data.activityStreak} />
            case 'key-stats':         return data.keyStats         && <KeyStatsWidget         key={id} data={data.keyStats} />
            default: return null
          }
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`. Create a couple of cards, review them, then open Dashboard. Due-forecast, namespace-ranking, leech-list should render with real numbers.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/widgets src/renderer/routes/dashboard.tsx
git commit -m "feat(renderer): dashboard with six widgets"
```

---

## Task 26: Settings route

**Files:**
- Modify: `src/renderer/routes/settings.tsx`

- [ ] **Step 1: Replace `src/renderer/routes/settings.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { WIDGET_IDS, type WidgetId } from '../../shared/constants'
import type { Config } from '../../shared/schema'
import { useAppStore } from '../stores/app-store'
import { unwrap } from '../lib/api'

export function SettingsRoute() {
  const { config } = useAppStore()
  const [local, setLocal] = useState<Config | null>(config)
  useEffect(() => { setLocal(config) }, [config])
  if (!local) return <div className="p-6 text-muted">Loading…</div>

  const toggle = async (id: WidgetId) => {
    const widgets = local.dashboard.widgets.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w)
    const next = await unwrap(window.api.updateConfig({ dashboard: { widgets } }))
    setLocal(next); useAppStore.setState({ config: next })
  }
  const move = async (id: WidgetId, dir: -1 | 1) => {
    const ws = [...local.dashboard.widgets].sort((a, b) => a.order - b.order)
    const idx = ws.findIndex(w => w.id === id)
    if (idx < 0) return
    const swap = idx + dir
    if (swap < 0 || swap >= ws.length) return
    const next = ws.map((w, i) => ({ ...w, order: i })).map((w, i) => {
      if (i === idx) return { ...w, order: swap }
      if (i === swap) return { ...w, order: idx }
      return w
    })
    const cfg = await unwrap(window.api.updateConfig({ dashboard: { widgets: next } }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }
  const setFsrs = async (patch: Partial<Config['fsrs']>) => {
    const cfg = await unwrap(window.api.updateConfig({ fsrs: { ...local.fsrs, ...patch } }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }
  const setExternalEditor = async (s: string) => {
    const cfg = await unwrap(window.api.updateConfig({ externalEditor: s || null }))
    setLocal(cfg); useAppStore.setState({ config: cfg })
  }

  const sorted = [...local.dashboard.widgets].sort((a, b) => a.order - b.order)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Data folder</h2>
        <div className="text-xs text-muted break-all">{local.rootPath}</div>
        <p className="text-xs text-muted mt-2">Changing this requires restart (v1 has no relocate wizard yet).</p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Dashboard widgets</h2>
        <div className="flex flex-col gap-2">
          {sorted.map(w => (
            <div key={w.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={w.enabled} onChange={() => toggle(w.id)} />
              <span className="flex-1">{w.id}</span>
              <button onClick={() => move(w.id, -1)} className="text-xs text-muted hover:text-fg">↑</button>
              <button onClick={() => move(w.id, 1)} className="text-xs text-muted hover:text-fg">↓</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">FSRS</h2>
        <label className="flex items-center gap-2 text-sm mb-2">
          <span className="w-48">Desired retention</span>
          <input type="number" step="0.01" min={0.5} max={0.99} value={local.fsrs.desiredRetention}
            onChange={e => setFsrs({ desiredRetention: Number(e.target.value) })}
            className="w-24 bg-transparent border border-border rounded px-2 py-1" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-48">Max interval (days)</span>
          <input type="number" step="1" min={1} value={local.fsrs.maximumInterval}
            onChange={e => setFsrs({ maximumInterval: Number(e.target.value) })}
            className="w-24 bg-transparent border border-border rounded px-2 py-1" />
        </label>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">External editor</h2>
        <input type="text" placeholder="e.g. code, cursor, subl" value={local.externalEditor ?? ''}
          onChange={e => setExternalEditor(e.target.value)}
          className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm" />
        <p className="text-xs text-muted mt-2">Leave blank to use the system default opener.</p>
        <p className="text-xs text-muted mt-1">Available widget ids: {WIDGET_IDS.join(', ')}</p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/routes/settings.tsx
git commit -m "feat(renderer): settings route for widgets, FSRS, editor"
```

---

## Task 27: Typography polish and prose styles

**Files:**
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Append prose styles to `src/renderer/styles/index.css`**

```css
.prose { color: rgb(var(--fg)); }
.prose h1, .prose h2, .prose h3 { font-family: Charter, Georgia, serif; font-weight: 600; margin-top: 1.2em; }
.prose h1 { font-size: 1.8em; } .prose h2 { font-size: 1.4em; } .prose h3 { font-size: 1.15em; }
.prose p { margin: 0.8em 0; }
.prose ul, .prose ol { padding-left: 1.5em; margin: 0.8em 0; }
.prose li { margin: 0.25em 0; }
.prose a { color: rgb(var(--accent)); text-decoration: underline; }
.prose code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; padding: 0.15em 0.35em; border-radius: 4px; background: rgb(var(--border)); }
.prose pre { margin: 1em 0; border-radius: 6px; overflow-x: auto; font-size: 0.9em; }
.prose pre code { background: transparent; padding: 0; }
.prose blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid rgb(var(--border)); color: rgb(var(--muted)); }
.prose table { border-collapse: collapse; margin: 1em 0; }
.prose th, .prose td { border: 1px solid rgb(var(--border)); padding: 0.4em 0.75em; }
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles/index.css
git commit -m "feat(ui): prose styles for markdown content"
```

---

## Task 28: E2E smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { trace: 'retain-on-failure' }
})
```

- [ ] **Step 2: Create `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'

test('boots, creates a card, reviews it', async () => {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../../dist-electron/main/index.js')]
  })
  const window = await app.firstWindow()
  await window.waitForSelector('text=Interview Prep')

  // Create a card
  await window.click('text=+ New card')
  await window.fill('input[placeholder="Question…"]', 'What is a CDN?')
  await window.fill('input[placeholder^="namespace"]', 'networking')
  await window.click('text=Save')
  await window.waitForSelector('text=Saved')

  // Review it
  await window.click('text=Review')
  await expect(window.locator('h1')).toContainText('CDN')
  await window.keyboard.press('Space')
  await window.keyboard.press('3') // Good
  await expect(window.locator('text=No cards due.')).toBeVisible()

  await app.close()
})
```

- [ ] **Step 3: Build and run**

```bash
npm run build
npm run e2e
```
Expected: smoke test passes.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts
git commit -m "test(e2e): smoke — create, review, session summary"
```

---

## Task 29: Packaging config

**Files:**
- Create: `electron-builder.yml`
- Create: `build/entitlements.mac.plist` (empty placeholder if needed)

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.interview-prep.app
productName: Interview Prep
directories:
  output: out
files:
  - dist/**
  - dist-electron/**
  - package.json
mac:
  category: public.app-category.education
  target:
    - dmg
    - zip
win:
  target: nsis
linux:
  target:
    - AppImage
    - deb
```

- [ ] **Step 2: Verify build runs for the current platform**

Run: `npm run dist`
Expected: installer written under `out/` — inspect to confirm. (Cross-platform signing is out of scope for v1.)

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "chore(build): add electron-builder config"
```

---

## Task 30: Final typecheck, tests, readme

**Files:**
- Create: `README.md` *(only if the user asks — plans default to not creating docs unless requested; if they do, include install + dev + build steps)*
- No other files

- [ ] **Step 1: Typecheck and full test suite**

```bash
npm run typecheck
npm test
npm run e2e
```
Expected: all pass.

- [ ] **Step 2: Manual smoke walkthrough**

- Launch `npm run dev`.
- Verify first-run: `config.json` is created at userData; data folder at `~/Documents/interview-prep`.
- Create three cards in different namespaces (incl. a nested one like `system-design/caching`).
- Review all three; rate Again/Good/Easy respectively.
- Open Dashboard; confirm namespace ranking + leech list populate.
- Toggle theme.
- Open one card in external editor; modify the body; save; verify the renderer reflects the change (watcher test).

- [ ] **Step 3: Commit any final tweaks and tag**

```bash
git commit --allow-empty -m "chore: v0.1.0 mvp complete"
git tag v0.1.0
```

---

## Self-review (author notes)

Coverage check against the spec:

- Data model, nested namespaces, per-card state JSON → Tasks 4, 6–13.
- Atomic writes, suppression of self-triggered watcher events → Tasks 6, 14, 16.
- FSRS with configurable retention/max interval → Tasks 12, 16, 26.
- In-app editor with live preview, autosave, external-editor launch → Tasks 21, 23.
- Review route with keyboard, session summary → Task 22.
- Browse route with search and namespace filter → Task 24.
- Dashboard with six customizable widgets → Tasks 16, 25, 26.
- Theme toggle + serif content → Tasks 20, 27.
- Settings, FSRS knobs, widget order → Task 26.
- E2E smoke test, packaging → Tasks 28, 29.
- Zod-validated IPC boundary, contextIsolation, sandbox → Tasks 16–18.
- Orphan-state GC on startup → Task 16.

Known intentional v1 scope cuts (called out in spec "out of scope"): drag-to-reorder dashboard (order buttons only for v1), data folder relocate wizard, FSRS parameter optimization, Anki import, mobile, multi-user.
