# TASK-031 — `electron-log` rotating file logger in main

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Replace `console.*` in the main process with structured rotating file logs at `userData/logs/main.log`. Foundation for diagnosing the "stuck on v0.0.1" pre-mortem risk and for the auto-update logger (TASK-014).

**Verifies:** prerequisite for "Copy diagnostics" (TASK-032) and for any post-mortem of an updater bug.

## Out of scope

- Crash reporter (TASK-032).
- Sentry / remote upload (deferred to v1.x per ADR-014).

## Plan

- Add `electron-log@^5` to `dependencies` (runtime).
- New `src/main/log.ts`:
  - Configure `log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')`.
  - `log.transports.file.maxSize = 1_048_576` (1 MB). Rotates to `main.old.log`.
  - `log.transports.console.level` = `'info'` in dev, `false` in production (file only).
  - Format: include timestamp, level, scope.
- Sweep `src/main/**/*.ts`: replace `console.log` / `console.warn` / `console.error` with `log.info` / `log.warn` / `log.error`. Boundary: keep `console.error` in `protocol.handle`'s 403 branch since that runs in a context where importing the logger is awkward — explicit one-line comment is fine.
- Confirm `electron-log` is externalized in `vite.config.ts`'s main bundle so it is required at runtime, not bundled.
- Wire `autoUpdater.logger = log` in TASK-014.

## Acceptance

- Launching the packaged build creates `~/Library/Application Support/Mnemo/logs/main.log` with structured entries.
- Rotation works: a forced sequence of large logs creates `main.old.log`.

## Notes

- The "Copy diagnostics" feature (TASK-032) tails this file. Without it, the Help menu item has no log content to copy.

