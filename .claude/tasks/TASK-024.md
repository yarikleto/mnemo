# TASK-024 — `src/main/window-state.ts`: persist + restore bounds, multi-monitor safe

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-023

## Goal

Remember where the user left their window — size, position, display, maximized/fullscreen state — and restore it on next launch. Handle the multi-monitor disconnect case gracefully.

**Verifies:** TVC-D1 (size restore), TVC-D2 (multi-monitor disconnect fallback). Trace: VC-4.

## Out of scope

- Last route (TASK-025).
- The fullscreen revert (TASK-023).

## Plan

- New module `src/main/window-state.ts` exporting `restoreWindowState(defaults): { x, y, width, height, maximized, fullscreen }` and `bindWindowStateSaver(win): () => void` (returns the unbinder).
- Persisted shape (separate file from `config.json`):
  ```ts
  type WindowState = {
    bounds: { x: number; y: number; width: number; height: number }
    maximized: boolean
    fullscreen: boolean
    displayId: number
  }
  ```
  Stored at `path.join(app.getPath('userData'), 'window-state.json')`. Read with try/catch; corrupt or absent file falls back to defaults (`width: 1280, height: 800`, centered on primary, `maximized: false`, `fullscreen: false`).
- Restore algorithm:
  1. Read JSON; if invalid, return defaults.
  2. `screen.getAllDisplays()`, find display with matching `displayId`. If none, use `screen.getPrimaryDisplay()`.
  3. Clamp `bounds` against the chosen display's `workArea` (e.g. a 4K-saved bounds restored on a 1080p display).
  4. Caller constructs the window with the clamped bounds, then `win.maximize()` if `maximized`, else `win.setFullScreen(true)` if `fullscreen`.
- Save algorithm (`bindWindowStateSaver`):
  - Listeners on `move`, `resize`, `maximize`, `unmaximize`, `enter-full-screen`, `leave-full-screen`.
  - Debounce with `setTimeout` clearing on each event; flush at 500 ms.
  - Capture `win.getNormalBounds()`, NOT `getBounds()`, when maximized / fullscreen — preserves "the size the user actually picked" for un-maximize restore.
  - Persist `displayId = screen.getDisplayMatching(bounds).id`.
  - On `app.before-quit`, do a synchronous final write so a quit during a drag doesn't lose the latest position.
- Wire from `src/main/index.ts`: call `restoreWindowState(...)` before `new BrowserWindow(...)`, then `bindWindowStateSaver(win)`.

## Acceptance

- TVC-D1: resize to 900×700, quit, relaunch — window appears at 900×700 on the same display.
- TVC-D2 (manual or scripted): place window on secondary monitor, quit, disconnect monitor, relaunch — window appears clamped to primary's `workArea`.
- Vitest unit test for the clamp logic with a fixture display geometry.

## Notes

- `electron-window-state` (the npm package) is rejected in ADR-010 — last release 2018, our implementation is ~60 LOC.
- Window state stays in its own file deliberately; mixing with `config.json` risks corrupting config on every drag.

