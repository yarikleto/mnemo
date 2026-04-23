# Interview Prep

A local-first, spaced-repetition app for practising software-engineering interviews. Cards are plain markdown files on your disk — you own them, you can `grep` them, and you can commit them to git. The app adds a review queue on top using [FSRS](https://github.com/open-spaced-repetition/ts-fsrs).

Built with Electron + React + Vite + TypeScript.

---

## Highlights

- **Markdown-native cards.** One `.md` file per card, front-matter metadata, free-form body. Works with any editor.
- **Folder = namespace.** The directory layout of your vault is the taxonomy — `algorithms/graphs/dijkstra.md` just works.
- **FSRS scheduling.** Modern spaced repetition with configurable retention and interval caps.
- **Live file watcher.** Edit a card in VS Code or Obsidian; the app picks it up instantly.
- **Rich dashboard.** Due forecast, namespace ranking, leech list, activity heatmap, streaks, key stats — toggle and reorder as you like.
- **Dark / light / system themes**, Inter + JetBrains Mono + Lora, CodeMirror-based in-app editor with GFM rendering and Shiki syntax highlighting.
- **Full-text search** powered by FlexSearch.
- **Cross-platform packaging** via electron-builder (macOS dmg/zip, Windows nsis, Linux AppImage/deb).

---

## Quick start

```bash
# 1. Install
npm install

# 2. Run the app in dev mode (Vite + Electron, hot reload)
npm run dev
```

On first launch the app will ask you to pick a **root folder** — this becomes your vault. Point it at any directory; it can be empty, or already contain markdown notes.

---

## Card format

Every card is a markdown file with YAML front-matter:

```markdown
---
id: 01HXYZABC...            # ULID, auto-generated on creation
question: What is Dijkstra's algorithm?
tags: [graphs, shortest-path]
created: 2026-01-15T10:23:00.000Z
---

Explain Dijkstra's algorithm, its complexity, and when it fails.

## Answer

Greedy single-source shortest path on non-negative edges...
```

- **`id`** — stable identifier; the scheduler keys review state off this.
- **`question`** — shown on the front of the card during review.
- **`tags`** — free-form, used for filtering.
- **`created`** — ISO 8601 timestamp.
- **Body** — everything below the front-matter. The answer, your notes, code snippets, diagrams, whatever.

Review state (stability, difficulty, due date, history) lives **separately** in app storage, not in the markdown — so your vault stays clean and diff-friendly.

### Namespaces

Your folder structure is the namespace. Given a root of `~/vault`:

```
~/vault/
├── algorithms/
│   ├── graphs/
│   │   └── dijkstra.md          → namespace: algorithms/graphs
│   └── dp/
│       └── knapsack.md          → namespace: algorithms/dp
└── system-design/
    └── rate-limiter.md          → namespace: system-design
```

The sidebar tree, namespace ranking widget, and per-namespace review filters all come from this layout.

---

## Day-to-day

| Route | What you do there |
|---|---|
| **Dashboard** | See what's due, how you're doing, configure widgets. |
| **Review** | Drill the queue. Rate each card `Again` / `Hard` / `Good` / `Easy`. |
| **Browse** | Full-text search, filter by namespace or tag, open any card. |
| **Editor** | Create and edit cards inside the app, or launch your external editor. |
| **Settings** | Change theme, desired retention, max interval, external editor, widget config. |

---

## Scripts

```bash
npm run dev          # Vite + Electron dev mode
npm run build        # Type-check and build renderer + main
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (unit)
npm run test:watch   # Vitest in watch mode
npm run e2e          # Playwright end-to-end tests
npm run preview      # Preview the built renderer
```

### Packaging

```bash
npm run dist         # Build + package for current OS
npm run dist:mac     # macOS (.dmg, .zip)
npm run dist:win     # Windows (NSIS installer)
npm run dist:linux   # Linux (AppImage, .deb)
```

Artifacts land in `out/`. See `electron-builder.yml` for target config.

---

## Project layout

```
src/
├── main/           # Electron main process
│   ├── index.ts    #   app bootstrap + window creation
│   ├── ipc/        #   IPC handlers (register.ts wires everything)
│   ├── store/      #   config + per-card review state persistence
│   ├── fsrs/       #   scheduler + due queue
│   ├── markdown/   #   front-matter parsing
│   ├── watcher.ts  #   chokidar vault watcher
│   └── paths.ts    #   OS-appropriate storage paths
├── preload/        # Context-bridge API exposed to renderer
├── renderer/       # React app (Vite)
│   ├── routes/     #   dashboard, review, browse, editor, settings
│   ├── components/ #   widgets, sidebar, tree, theme toggle, …
│   ├── stores/     #   zustand stores
│   └── styles/     #   Tailwind entry
└── shared/         # Zod schemas + constants shared across processes
```

---

## Data storage

- **Your cards** — live wherever you chose as the root folder. Back them up like any other notes.
- **App data** (config, review state, FSRS history) — stored in the OS-standard app-data directory:
  - macOS: `~/Library/Application Support/Interview Prep/`
  - Windows: `%APPDATA%/Interview Prep/`
  - Linux: `~/.config/Interview Prep/`

Writes are atomic (temp file + rename) so a crash mid-write won't corrupt your state.

---

## Tech stack

Electron 31 · React 18 · Vite 5 · TypeScript 5 · Tailwind 3 · Zustand · Zod · ts-fsrs · CodeMirror 6 · unified/remark/rehype · Shiki · FlexSearch · chokidar · Vitest · Playwright.

---

## License

Private / unpublished. Not for redistribution.
