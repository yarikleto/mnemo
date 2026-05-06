# TASK-014 — `src/main/updater.ts`: poll, download, push `update:ready`

**Milestone:** M0
**Owner:** Developer
**Size:** S
**Depends on:** TASK-004, TASK-005

## Goal

Wire `electron-updater` into the main process so a packaged Mnemo silently checks GitHub Releases for newer versions, downloads them in the background, and notifies the renderer when one is ready to install. Inert in dev.

**Verifies:** TVC-E1 (checks within 60 s of `whenReady`), TVC-E4 (`verifyUpdateCodeSignature` ran). Trace: VC-5, VC-1.

## Out of scope

- Renderer banner UX (TASK-015).
- The actual round-trip rehearsal (TASK-018).

## Plan

- Create `src/main/updater.ts` exporting two functions: `startAutoUpdater(win, getConfig)` and `setupUpdaterIpc(win)` (the latter exposes a `restartToInstall` IPC verb).
- Behaviour:
  - Early-out `if (!app.isPackaged) return;`.
  - 30-second startup delay before the first `checkForUpdatesAndNotify()` so the cold-start path is not contended.
  - 6-hour `setInterval` for subsequent checks.
  - On `update-downloaded`, `win.webContents.send('update:ready', { version })`.
  - Call `app.relaunch` + `autoUpdater.quitAndInstall()` only when the renderer asks via `restartToInstall` IPC.
  - `autoUpdater.logger = log` (depends on TASK-031 — if TASK-031 has not landed yet, fall back to `console`).
  - `autoUpdater.autoDownload = true`, `autoUpdater.autoInstallOnAppQuit = false` (we want the renderer to choose the moment).
  - **NEVER** set `verifyUpdateCodeSignature: false`. Default is true; do not disable.
- Add a settings hook: read `Config.autoUpdate?.enabled` (default `true`). When false, skip the polling entirely. Schema field added in TASK-020 (Config schema is already being touched there for `onboardedAt`).
- Wire into `app.whenReady().then(...)` in `src/main/index.ts` after `createWindow`.

## Acceptance

- A packaged build, when launched on a network with a real `latest.yml`, calls `checkForUpdatesAndNotify` within 60 s of window ready (verified by `userData/logs/main.log`).
- A dev `npm run dev` launch logs nothing from the updater module (early-out works).
- TVC-E4 satisfied by the default config (signature verification on).

## Notes

- The `update.electronjs.org` URL is NOT used. We go directly to GitHub Releases via `electron-updater`'s GitHub provider, which honours the `publish:` block from TASK-005. Same UX, more flexibility (Linux AppImage support, future channel support).

