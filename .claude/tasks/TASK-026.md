# TASK-026 — Single-instance lock + `second-instance` focus handler

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Make a second Mnemo launch focus the existing window instead of spawning a second process. Eliminates a vault-corruption hazard on Windows / Linux (two chokidar watchers, two `CardIndex` instances racing).

**Verifies:** TVC-H1 (second instance exits, first focuses). Trace: defense-in-depth, supports VC-3 + VC-7.

## Out of scope

- Deep-link handling (`mnemo://` URLs, `.mnemo.zip` file association) — v2 territory; the `second-instance` handler is wired now so the plumbing is correct when v2 lands.

## Plan

- At the very top of `src/main/index.ts`, before `app.whenReady()`:
  ```ts
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
      }
    })
  }
  ```
- Promote `mainWindow` to module scope so the `second-instance` handler can reach it.
- This is harmless on macOS (the OS already enforces app-singleton behaviour) and load-bearing on Windows / Linux.

## Acceptance

- TVC-H1 (manual): launch Mnemo, then double-click the app icon (or `npm run dist:mac` and open the DMG twice). The second process exits in <200 ms; the first window comes to front.
- The lock is a no-op for `npm run dev` (Vite dev server only spawns one Electron instance).

## Notes

- `requestSingleInstanceLock` is the official, race-free, cross-platform primitive. ADR-013 explicitly rejects PID-file alternatives.

