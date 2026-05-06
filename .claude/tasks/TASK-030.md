# TASK-030 — Renderer `onMenuCommand` subscriber + handlers

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-029

## Goal

Wire the renderer to react to menu push events: navigate, open dialogs, toggle theme, focus find, etc. Reuses existing handlers where possible (Cmd-N already exists in `GlobalShortcuts`; the menu just adds the OS-level binding).

**Verifies:** the menu UX side of M1.

## Out of scope

- Building the menu (TASK-028, TASK-029).

## Plan

- Extend the preload `Api` with `onMenuCommand(cb: (verb: string) => void): () => void`. Subscribes to all `menu:*` channels via a single `ipcRenderer.on('menu:*', …)` — actually, wildcards aren't supported; expose a handful of typed `onMenu<Verb>` subscribers OR a single `onMenuCommand` that forwards a discriminated-union event. Pick the latter: the preload subscribes to each `menu:<verb>` channel via a fixed list and forwards to the single callback with the verb name.
- In `src/renderer/app.tsx`, add a `<MenuRouter>` component (mounted alongside `GlobalShortcuts`) that subscribes via `useEffect` and dispatches:
  - `menu:open-settings` → `navigate('/settings')`.
  - `menu:new-card` → `navigate('/editor/new')` (already covered by `GlobalShortcuts`; the menu just provides the macOS path).
  - `menu:nav-review|browse|dashboard` → `navigate('/<route>')`.
  - `menu:toggle-theme` → `useAppStore.toggleTheme()` (existing function on the store).
  - `menu:find` → focus the search input. Implement by setting a Zustand flag the relevant components watch (or by dispatching a window-level CustomEvent — pick the cleaner one given the existing search architecture).
  - `menu:import|export` → set a Zustand flag the existing import/export dialog components consume.
  - `menu:open-vault-folder` → call the same flow `/settings`'s "Change vault…" button uses (TASK-022).
  - `menu:copy-diagnostics` → call a `copyDiagnostics` IPC that returns the diagnostics blob; renderer puts it on the clipboard via `navigator.clipboard.writeText`. (Pairs with TASK-032.)
- Keep `GlobalShortcuts` for the in-renderer Cmd-N / Cmd-, on Windows / Linux where there is no menu.

## Acceptance

- Cmd-1 from the macOS menu navigates to `/review`. Cmd-2 → `/browse`. Cmd-3 → `/dashboard`. Cmd-, → `/settings`.
- Cmd-Shift-T toggles theme.
- "Import…" from File menu opens the existing import dialog.

## Notes

- The macOS menu accelerators take precedence at the OS level. `GlobalShortcuts` keeps Windows / Linux feeling identical without a menu.

