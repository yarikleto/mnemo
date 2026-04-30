# Project instructions

This file provides guidance to AI coding assistants (Claude Code via `CLAUDE.md`, Codex via the `AGENTS.md` symlink) working with code in this repository.

## Commands

```bash
npm run dev          # Vite + Electron, hot reload (keeps running — don't use for boot checks)
npm run build        # tsc --noEmit + vite build → dist/ (renderer) and dist-electron/ (main, preload)
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (unit). Playwright e2e specs are excluded.
npm run test:watch
npm run e2e          # Playwright end-to-end
npm run dist[:mac|:win|:linux]   # build + electron-builder package → out/
```

Run a single Vitest file or test:

```bash
npx vitest run path/to/file.test.ts
npx vitest run -t "name of test"
```

Vite path aliases (match in tests and imports): `@main/*`, `@renderer/*`, `@shared/*`.

### Shipping work: push directly to `main`

This repo ships straight from `main`. No feature branches, no PRs. When the user asks you to push a fix:

1. Commit on `main`.
2. `git push origin main`.

Don't cut feature branches, don't run `gh pr create`, don't wait for review. The user reviews the diff before asking you to push, so the push *is* the ship step.

Force-pushing `main` is still a destructive operation — confirm with the user before any `push --force` / `push --force-with-lease` against `main`.

After changing anything in `src/main`, `src/preload`, or `src/renderer`, verify the app actually boots rather than relying on typecheck alone. Use the `electron-debug` skill — it launches the built bundle via Playwright, forwards main stdio + renderer console + pageerrors, and intercepts IPC. Triggered with `npm run build && node ./tools/electron-debug/run.mjs --duration 4000`. See `.claude/skills/electron-debug/SKILL.md` (Claude Code) or `.codex/skills/electron-debug/SKILL.md` (Codex) for flags, scripted UI flows, and failure-dump layout.

Known gotcha the skill catches: `webPreferences.preload` in `src/main/index.ts` must point at the `.mjs` output emitted by `vite-plugin-electron`, not `.js`. Also: do not introduce PRNG-detecting libs (`ulid`, some `uuid`) into the main bundle — they crash on ESM import. A node-`crypto` ULID lives at `src/main/id.ts`; use that.

### Authoring cards

Two tools, different jobs. Both CLIs have the same capabilities, only the dispatch mechanism differs.

- **`card-researcher`** — use when the user asks you to **research a topic and turn it into cards**. Triggers: "make me cards about X", "learn me Rust ownership", "drill me on the French subjunctive", "research X and quiz me", any batch-of-cards-on-an-unfamiliar-topic request. Does its own web research, decomposes the topic into atomic cards, writes 2–3 prompt variants per card (different retrieval angles: mechanism / scenario / consequence), and saves them via `creating-card`.
  - **In Claude Code**: delegate via the Agent tool with `subagent_type: "card-researcher"` (see `.claude/agents/card-researcher.md`); pass the topic plus any constraints (count, namespace, angle, language) in the prompt.
  - **In Codex**: activate the `card-researcher` skill in-session (see `.codex/skills/card-researcher/SKILL.md`). Codex has no subagent dispatch primitive, so the main session runs the workflow inline. Workflow, quality bar, and output format are identical.
- **`creating-card`** — use when the user hands you **the card content already** (a single explanation they wrote, a conversation snippet, a paragraph from a doc) and just wants it committed as a card. No research needed, no batching — just format and write. Invoke the `creating-card` skill directly in either CLI (see `.claude/skills/creating-card/SKILL.md` or `.codex/skills/creating-card/SKILL.md`). The helper script at `./tools/authoring/create-card.mjs` is the binary both sides shell out to.

Do NOT use `card-researcher` to turn a single already-written note into one card — that's overkill and burns research tokens. Do NOT hand-roll card YAML yourself when `creating-card` exists.

## Architecture

Electron app with three processes and a strict boundary between them.

### Process layout

- **Main** (`src/main/`) — owns all disk I/O, the card index, the file watcher, and the FSRS scheduler. Never imports from `@renderer`.
- **Preload** (`src/preload/index.ts`) — single file. Exposes `window.api` via `contextBridge`, every method wrapping `ipcRenderer.invoke`. `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- **Renderer** (`src/renderer/`) — React + Vite + Tailwind. Pure UI, consumes `window.api` only. Routes in `routes/` (hash-routed), widgets in `components/widgets/`, Zustand stores in `stores/`.
- **Shared** (`src/shared/`) — Zod schemas (`schema.ts`), enums/widget IDs (`constants.ts`), and the `Api` TypeScript surface (`api.ts`). Importable from both sides. Changing `api.ts` means updating `src/preload/index.ts` **and** `src/main/ipc/register.ts` together.

### IPC contract

All renderer→main calls go through `ipcRenderer.invoke` and return `ApiResult<T> = { ok: true, data } | { ok: false, error }`. The `h(...)` helper in `src/main/ipc/register.ts` parses inputs with Zod and wraps the handler in try/catch to produce that envelope — always register new channels through it, not `ipcMain.handle` directly. Main→renderer push events (`card-added`, `card-changed`, `card-removed`, `index-rebuilt`) are sent via `win.webContents.send` and subscribed in preload with `on()`.

### Data model

Two independent stores under the user-selected `rootPath`:

- **`cards/`** — one `.md` per card with YAML front-matter (`id` = ULID, `prompts` = array of `{id, text}` variants, `tags`, `created`). Directory layout = namespace. This is user-owned content (git-friendly).
- **`state/<id>.json`** — FSRS review state (stability, difficulty, due, history) keyed by card `id`. App-owned; kept out of the markdown deliberately.

App config lives at `app.getPath('userData')/config.json` (see `src/main/paths.ts`). Schema in `src/shared/schema.ts`.

### Write path (critical invariant)

Card mutations go: IPC handler → `store/cards.ts` (`atomicWrite` = write tmp + rename) → `ctx.watcher.suppressNext(path, mtime, hash)` → `ctx.index.upsert(meta)` → return. The **suppressNext** call is essential: chokidar will fire a `change` event for our own write, and without suppression the watcher re-emits `card-changed` and fights with the handler. When adding a new IPC that writes to a card file, follow the existing pattern in `createCard` / `updateCard` / `moveCard` exactly.

### Index + watcher

`CardIndex` (`src/main/store/index.ts`) is an in-memory `Map<id, CardMeta>` built once on startup from `walkCardFiles` and kept in sync by `Watcher` (chokidar on `cardsDir`). The watcher only reacts to `.md` files, silently swallows parse errors for cards with corrupt front-matter (waits for user to fix), and emits `card-added|changed|removed` which `registerIpc` forwards to the renderer. On startup, orphan state files (state without a matching card in the index) are deleted — see the tail of `registerIpc`.

### FSRS

`src/main/fsrs/scheduler.ts` wraps `ts-fsrs` with the user's `desiredRetention` / `maximumInterval` from config. `buildDueQueue` (`queue.ts`) reads every card's state, filters by due ≤ now (optionally by namespace), and returns the review queue. `rateCard` appends to `history` and returns the next `ReviewState`, which the handler atomic-writes to `state/<id>.json`.

### Dashboard

`getDashboardData` takes the list of enabled `WidgetId`s and computes only those. All widgets read the same `(meta, state)` tuple for every card once, then fan out. New widgets: add the ID to `WIDGET_IDS` in `shared/constants.ts`, the computation to `computeDashboard` in `ipc/register.ts`, the shape to `DashboardData` in `shared/api.ts`, and the renderer component in `src/renderer/components/widgets/`.

### Build output layout

- `dist/` — renderer bundle (HTML + JS + assets), loaded via `loadFile` in packaged builds or `VITE_DEV_SERVER_URL` in dev.
- `dist-electron/main/index.js` — main entry, referenced by `package.json#main` and by the electron-debug skill.
- `dist-electron/preload/index.mjs` — preload bundle. The `.mjs` extension is load-bearing; `src/main/index.ts` references it explicitly.

`electron`, `chokidar`, and `fsevents` are externalized from the main bundle (see `vite.config.ts`) — they must remain runtime deps in `package.json`, not devDeps.
