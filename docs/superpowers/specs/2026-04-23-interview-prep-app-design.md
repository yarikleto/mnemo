# SWE Interview Prep App — Design

**Status:** Approved for implementation
**Date:** 2026-04-23

## Purpose

A local, file-backed spaced-repetition app for software-engineering interview prep. The user studies questions (concepts, system design, coding), rates recall, and the app schedules reviews using FSRS. All content is plain markdown on disk so the user or an LLM can author and edit cards outside the app.

## Scope (v1)

- Single user, fully local, Electron desktop app (macOS/Windows/Linux).
- One uniform card type: question + markdown answer body.
- Namespaces = nested folder hierarchy under `cards/`.
- Tags as an orthogonal dimension in frontmatter.
- FSRS scheduling with four-button rating (Again / Hard / Good / Easy).
- In-app markdown editor with live preview; file watcher keeps in-app view in sync when the user edits externally.
- "Open in external editor" shortcut.
- Customizable dashboard with six opt-in widgets.
- Light + dark theme with toggle; serif content body, sans-serif UI chrome.

## Out of scope (v1)

- Multi-user accounts, auth, cloud sync.
- Mobile.
- Per-card media attachments beyond what markdown links support.
- FSRS parameter optimization beyond defaults + a few knobs.
- Import/export of Anki decks (could be added later).
- Text-to-speech, image occlusion, cloze deletions.

## Tech stack

- **Runtime:** Electron (latest stable).
- **Renderer:** React 18 + TypeScript + Vite; Tailwind CSS; shadcn/ui for baseline components.
- **Editor:** CodeMirror 6 (markdown mode).
- **Markdown rendering:** `unified` + `remark-parse` + `remark-gfm` + `rehype-react` + Shiki (syntax highlighting). Mermaid via a remark plugin.
- **Spaced repetition:** `ts-fsrs` (official TypeScript port of FSRS).
- **Filesystem:** `chokidar` (watch), `gray-matter` (frontmatter), `fs/promises`.
- **State:** Zustand in renderer.
- **ID generation:** ULID.
- **Search:** FlexSearch (in-memory, indexed on startup and incrementally updated).
- **Packaging:** `electron-builder`.
- **Validation:** Zod on the IPC boundary.

## Data model

### Root layout

The user picks a data folder on first launch (default `~/Documents/interview-prep`). Structure:

```
<root>/
  cards/                       # human-authored content
    system-design/
      caching/
        cdn.md
        redis-patterns.md
      consensus/
        raft.md
    concurrency/
      mutex-vs-semaphore.md
  state/                       # FSRS state, one JSON per card, keyed by ULID
    <card-id>.json
  config.json                  # app settings (theme, widgets, root path)
```

### Card file (`*.md`)

```md
---
id: 01HXYZ...
question: "How does a CDN decide which edge serves a request?"
tags: [networking, interview-favorite]
created: 2026-04-23T10:12:00Z
---

Answer body in markdown. Code blocks, tables, mermaid diagrams, images.
```

- `id`: ULID, generated on create, never changes. Survives rename/move.
- `question`: single line. Required.
- `tags`: optional list of strings.
- `created`: ISO timestamp, set on create.
- Body: everything after the frontmatter block. Unrestricted markdown.

### State file (`state/<id>.json`)

FSRS fields managed by the app; users do not edit these.

```json
{
  "id": "01HXYZ...",
  "due": "2026-04-25T09:00:00Z",
  "stability": 4.93,
  "difficulty": 6.81,
  "elapsed_days": 0,
  "scheduled_days": 2,
  "reps": 3,
  "lapses": 1,
  "state": "Review",
  "last_review": "2026-04-23T09:00:00Z",
  "history": [
    {"ts": "2026-04-23T09:00:00Z", "rating": "Good", "elapsed_days": 1}
  ]
}
```

### Config file (`config.json`)

```json
{
  "rootPath": "/Users/.../interview-prep",
  "theme": "system",
  "dashboard": {
    "widgets": [
      {"id": "due-forecast", "enabled": true,  "order": 0},
      {"id": "namespace-ranking", "enabled": true, "order": 1},
      {"id": "leech-list", "enabled": true, "order": 2},
      {"id": "heatmap", "enabled": false, "order": 3},
      {"id": "activity-streak", "enabled": false, "order": 4},
      {"id": "key-stats", "enabled": false, "order": 5}
    ]
  },
  "fsrs": {
    "desiredRetention": 0.9,
    "maximumInterval": 36500
  },
  "externalEditor": null
}
```

## Architecture

Standard Electron split — no Node APIs in the renderer.

```
Renderer (React + Vite)
  routes: /review /browse /editor/:id /dashboard /settings
  state: Zustand store
  calls: window.api.* (typed via shared/api.ts)
           │
           │ contextBridge IPC
           ▼
Main process (Node)
  src/main/
    ipc/            thin handlers, validate args with Zod
    store/
      cards.ts      list/read/write/move/delete cards
      state.ts      load/save FSRS state per card
      config.ts     read/write config.json
      index.ts      in-memory index (id → path, metadata)
    fsrs/
      scheduler.ts  wraps ts-fsrs; rate() returns new state
      queue.ts      builds due queue (filters by namespace)
    watcher.ts      chokidar; emits card-changed events
    markdown/
      parse.ts      gray-matter + ULID generation on create
    editor-open.ts  spawn $EDITOR or system default
```

### Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Only `window.api` is exposed, via `contextBridge`.
- Every IPC handler validates its arguments with Zod.
- Renderer has no `fs`, no `child_process`, no `require`.

### IPC surface

See `shared/api.ts` (to be generated in implementation). Summary:

**Reads:** `listNamespaces`, `listCards`, `getDueQueue`, `readCard`, `getDashboardData`.
**Writes:** `createCard`, `updateCard`, `moveCard`, `deleteCard`, `rateReview`, `openInExternalEditor`.
**Config:** `getConfig`, `updateConfig`.
**Events (main → renderer):** `card-changed`, `card-added`, `card-removed`, `index-rebuilt`.

### Index + watcher

On startup, the main process walks `cards/` and builds an in-memory index: `{ id → { path, question, tags, namespace, mtime, bodyHash } }`. State files are loaded lazily and cached.

`chokidar` watches `cards/` and `state/`. Debounce 300ms. To avoid feedback loops from the app's own writes, each write records the new mtime + body hash; incoming watcher events matching that tuple are suppressed.

Orphan state (state file whose card was deleted) is detected on scan; renderer is notified and can offer to garbage-collect with a confirmation dialog.

## Features

### `/review` — study queue

1. Build due queue: cards with `state.due ≤ now`, filtered by currently-selected namespaces in the sidebar tree.
2. Card shows question only, with breadcrumb (`system-design / caching / cdn`).
3. Keyboard:
   - `Space` reveal answer
   - `1 2 3 4` rate Again / Hard / Good / Easy (only active after reveal)
   - `E` open card in editor route
   - `Esc` exit session
4. Rating calls `rateReview(id, rating)`; main computes new state via ts-fsrs and writes `state/<id>.json` atomically.
5. Session end: summary (reviewed, again count, avg time per card) with "study more" for optional overdue + new cards.

### `/browse` — list / search

Table columns: Question · Namespace · Tags · Retention · Due · Last reviewed.
Filters: namespace tree (checkboxes), tag chips, state (New/Learning/Review/Relearning), text search (FlexSearch over question + body). Click row → `/editor/:id`.

### `/editor/:id` and `/editor/new?ns=...`

- Split pane: CodeMirror 6 (left) + live preview (right). Toggle to single pane.
- Fields: question (single line), namespace (breadcrumb dropdown with tree picker), tags (chip input), body (markdown).
- Changing namespace moves the `.md` file to the new folder; state stays keyed by id.
- `Cmd/Ctrl+S` saves; auto-save after 2s idle.
- "Open in external editor" button → `editor-open.ts` spawns `$EDITOR` (if set in config) or platform default; watcher catches the returning edit.
- New-card shortcut `Cmd/Ctrl+N`. Prefilled namespace = currently-selected tree node.

### `/dashboard` — customizable widgets

Widget grid (drag-to-reorder, resize). All six available; toggle + order in Settings. Default on: Due-forecast, Namespace-ranking, Leech-list.

Widgets:

1. **Due today + 7-day forecast** — today's count, bar chart for next 7 days, time estimate.
2. **Ranked namespace retention** — folders sorted weakest → strongest by retention %; click → filters `/browse`.
3. **Topic heatmap grid** — every card as a tile colored by retention strength; hover = question; click = open card.
4. **Activity + streak** — 90-day GitHub-style calendar, current streak, lifetime total.
5. **Leech list** — top 10 cards by lapse count; click → card.
6. **Key stats tiles** — total cards, overall retention %, struggling count (lapses ≥ 3 or state=Relearning), mastered count (stability ≥ 30d, reps ≥ 4).

### Sidebar (persistent)

Namespace tree with checkboxes (drives queue + browse filters). Due-count badges per namespace. `+ New card` button. Route links (Review · Browse · Dashboard · Settings). Theme toggle at the bottom.

### Settings

- Theme: system / light / dark.
- Data folder path (relocate with move dialog).
- Dashboard widgets: toggle + reorder.
- FSRS: desired retention (default 0.9), maximum interval (default 100y).
- External editor command override.

## Visual design

- Dark + light themes with a system/light/dark toggle. Theme lives in config.
- Card content (question + rendered answer body): serif (Charter / Georgia fallback) for reading comfort.
- UI chrome: system sans-serif (Inter / -apple-system).
- Linear-style quiet dark mode, Notion-style warm light mode (off-white paper feel).
- Tight spacing, subtle borders, muted colors; single accent color for the active rating / primary action.

## Error handling

- All IPC handlers wrap work in try/catch, return `{ ok: true, data }` or `{ ok: false, error }`. Renderer surfaces errors via a toast.
- Writes are atomic: write to `*.tmp` then `rename`. Failures leave the previous file intact.
- Corrupt/invalid frontmatter: card is flagged in the index with a `parseError` field; appears in browse with a warning icon; review queue skips it.
- Missing state file for an indexed card: treated as "new"; FSRS starts from scratch on first review.
- Orphan state (card file deleted): surfaced on scan; user can garbage-collect via a dialog.
- Data folder missing/unreadable on startup: blocking modal prompts to choose a new location.
- Watcher disconnects or backs off: user-visible status indicator; manual "rescan" menu item.

## Testing strategy

- **Unit tests (Vitest):** frontmatter parsing, FSRS scheduler wrapper (deterministic dates), queue construction, index mutations, config schema.
- **IPC contract tests:** each handler tested against Zod schemas with valid and invalid inputs.
- **Integration tests (Vitest + tmp dirs):** create/edit/move/delete flows end-to-end against a real temporary data folder.
- **UI tests (Playwright against packaged Electron):** smoke path — first-run setup, create card, review card, dashboard loads, theme toggle.
- Target: ≥ 80% line coverage on `src/main/`; renderer component coverage meaningful on the review flow and editor.

## Repository layout

```
anki/                          (this repo)
  docs/superpowers/specs/      (this spec + future ones)
  src/
    main/
      index.ts                 Electron main entry
      ipc/
      store/
      fsrs/
      watcher.ts
      markdown/
    preload/
      index.ts                 contextBridge → window.api
    renderer/
      index.html
      main.tsx
      app.tsx
      routes/
      components/
      stores/                  Zustand
      styles/
    shared/
      api.ts                   typed IPC surface
      schema.ts                Zod + TS types for Card, State, Config
  tests/
    unit/
    integration/
    e2e/
  electron-builder.yml
  package.json
  tsconfig.json
  vite.config.ts
```

## Milestones (for planning)

1. Scaffold: Electron + Vite + React + TS + Tailwind + shadcn, secure defaults, two-process hello world.
2. Data layer: schema, index, store modules, file watcher, atomic writes, tests.
3. FSRS: scheduler wrapper + queue builder + rateReview IPC + tests.
4. Review route: minimal UI, keyboard bindings, end-to-end flow against real files.
5. Editor route: CodeMirror + preview + save/move; external-editor integration.
6. Browse route: table, filters, search.
7. Dashboard: widget framework, six widgets, drag-to-reorder.
8. Sidebar + namespace tree + settings.
9. Theme: dark/light, serif content, polish pass.
10. Packaging: electron-builder config for mac/win/linux, auto-update later.

## Open questions (for implementation)

None blocking. FSRS parameter tuning and any advanced visuals (e.g. mermaid rendering polish) can be handled in implementation.
