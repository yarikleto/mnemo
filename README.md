# Interview Prep

A local-first spaced-repetition app for anything you want to memorise — languages, algorithms, medicine, trivia, whatever. Cards are plain markdown files you own: edit in any editor, track in git. Scheduling uses [FSRS](https://github.com/open-spaced-repetition/ts-fsrs).

## Features

- Plain-markdown cards with YAML front-matter
- Folder layout defines the namespace
- FSRS scheduling with configurable retention
- Live file watcher — edit cards in any editor, the app updates instantly
- Full-text search
- Configurable dashboard (due forecast, leech list, heatmap, streaks, namespace ranking, key stats)
- Dark, light, and system themes
- Cross-platform packaging for macOS, Windows, and Linux

## Getting started

```bash
npm install
npm run dev
```

On first launch, pick a root folder — it becomes your vault.

## Card format

```markdown
---
id: 01HXYZABC...
question: What does "常識" mean?
tags: [japanese, vocab]
created: 2026-01-15T10:23:00.000Z
---

Free-form markdown. Explanations, code, diagrams — whatever helps you remember.
```

| Field | Meaning |
|---|---|
| `id` | ULID, auto-generated. The scheduler keys review state off this. |
| `question` | Shown on the front of the card during review. |
| `tags` | Free-form, used for filtering and search. |
| `created` | ISO 8601 timestamp. |

Review state (stability, difficulty, due date, history) lives in a separate `state/` directory next to your cards, so your markdown stays clean and diff-friendly.

## Namespaces

The folder a card lives in is its namespace.

```
vault/
  cards/
    languages/
      japanese/vocab.md         → languages/japanese
      spanish/verbs.md          → languages/spanish
    algorithms/
      graphs/dijkstra.md        → algorithms/graphs
    medicine/
      anatomy/heart.md          → medicine/anatomy
```

The sidebar tree, namespace ranking widget, and review filters all derive from this layout.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite + Electron with hot reload |
| `npm run build` | Typecheck and build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end |
| `npm run dist` | Package for the current OS |
| `npm run dist:mac` / `:win` / `:linux` | Platform-specific builds |

Packaging artifacts land in `out/`. Targets are configured in `electron-builder.yml`.

## Project structure

```
src/
├── main/       Electron main process — disk I/O, FSRS, IPC, file watcher
├── preload/    Context-bridge API exposed to the renderer
├── renderer/   React UI (routes, widgets, stores)
└── shared/     Zod schemas and types used by both sides
```

## Data

- **Cards and review state** live under the vault folder you picked — back them up like any other notes.
- **App config** is stored in the OS-standard app-data directory:
  - macOS — `~/Library/Application Support/Interview Prep/`
  - Windows — `%APPDATA%/Interview Prep/`
  - Linux — `~/.config/Interview Prep/`

All writes are atomic (temp file + rename), so a crash mid-write won't corrupt state.

## Stack

Electron · React · Vite · TypeScript · Tailwind · Zustand · Zod · ts-fsrs · CodeMirror · unified · Shiki · FlexSearch · chokidar.
