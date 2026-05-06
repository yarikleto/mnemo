# TASK-032 — `crashReporter` (disk-only) + "Copy Diagnostics" Help menu item

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-028, TASK-031

## Goal

Capture native crashes to disk (no remote upload — local-first ethos) and give the user a single-click way to copy app version + OS + last 50 log lines into the clipboard for support. Closes the M1 observability story.

**Verifies:** infrastructure for triaging update / crash bugs without remote telemetry.

## Out of scope

- Remote crash upload (Sentry — deferred to v1.x per ADR-014).
- Renderer crash capture (handled by Chromium itself; native crashes in main is the main hole this closes).

## Plan

- In `src/main/index.ts`, before `app.whenReady()`: `crashReporter.start({ uploadToServer: false, submitURL: '' })`. Native crashes write to `userData/Crashpad/`.
- Add a new IPC verb `getDiagnostics(): Promise<ApiResult<{ blob: string }>>`:
  - Schema: `VOID`.
  - Handler: read `app.getVersion()`, `os.platform()`, `os.release()`, `process.versions`, tail the last ~50 lines of `userData/logs/main.log`, and return as a single string.
- Mirror in preload as `getDiagnostics()`.
- Hook the Help menu's "Copy Diagnostics" item (TASK-028's template includes this entry): the menu sends `menu:copy-diagnostics`; the renderer subscriber (TASK-030) calls `getDiagnostics`, then `navigator.clipboard.writeText(blob)`, then shows a toast "Diagnostics copied to clipboard."

## Acceptance

- Triggering Help → Copy Diagnostics on macOS copies a multi-line blob containing the version + OS + log tail to the clipboard.
- A forced crash (e.g. a deliberate `process.crash()` in a dev build) leaves a dump in `userData/Crashpad/`.

## Notes

- `submitURL: ''` keeps the reporter local. If we ever opt into Sentry, we add the upload URL behind a settings toggle defaulting OFF (per ADR-014).

