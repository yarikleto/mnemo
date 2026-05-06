# TASK-019 — `pickVaultFolder` IPC channel

**Milestone:** M1 — First-run UX
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Add a new IPC verb that opens an OS folder picker and returns the chosen path (or `null` on cancel). Pure plumbing; no UI yet.

**Verifies:** prerequisite for TVC-B3 (folder picker round-trip). Trace: VC-2.

## Out of scope

- Onboarding screen (TASK-022).
- The "complete onboarding" verb (TASK-020).

## Plan

- Add the channel to `src/shared/api.ts`: `pickVaultFolder(): Promise<ApiResult<{ path: string } | null>>`.
- Mirror in `src/preload/index.ts` as a thin `ipcRenderer.invoke` wrapper.
- Register in `src/main/ipc/register.ts` via the `h(...)` helper. Schema is `VOID`. Handler calls `dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Pick a vault folder' })` and returns either `{ path: result.filePaths[0] }` or `null` when canceled.
- No watcher / index changes — picking a folder does not commit to it. That happens in `completeOnboarding`.

## Acceptance

- New unit / integration test in the existing Vitest suite that mocks `dialog.showOpenDialog` and asserts the handler returns `{ ok: true, data: { path } }` for a chosen path and `{ ok: true, data: null }` for a cancel.
- Renderer can call `window.api.pickVaultFolder()` (manual smoke).

## Notes

- The dialog is bound to the `BrowserWindow` so it appears as a sheet on macOS, modal on Windows / Linux.

