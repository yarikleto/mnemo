# TASK-004 — Add `electron-updater`, `@electron/fuses`, `@electron/notarize` to package.json

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** —

## Goal

Pin the three new build / runtime dependencies the v1 release pipeline needs. Get them into the lockfile before any consuming task tries to import them.

**Verifies:** prerequisite for TVC-A4 (fuses), TVC-E1–E4 (auto-update), TVC-A1–A3 (notarize). Trace: VC-1, VC-5.

## Out of scope

- Wiring them in (TASK-009 for notarize, TASK-013 for fuses, TASK-014 for updater).

## Plan

- `electron-updater` lands in `dependencies` (runs in main at runtime, not just at build time). Pin the minimum at `^6.3.9` to inherit the CVE-2024-39698 fix.
- `@electron/notarize` lands in `devDependencies` (only the `afterSign` hook uses it).
- `@electron/fuses` lands in `devDependencies` (only the `afterPack` hook uses it).
- Run `npm install` once, commit `package.json` and `package-lock.json` together.
- Confirm `electron-updater`, `chokidar`, `fsevents`, `electron-log` (added in TASK-031) are externalized in `vite.config.ts` so the main bundle does not try to inline them. The Vite plugin externalizes `electron` already; verify the others.

## Acceptance

- `npm ls electron-updater` reports `^6.3.9` or later, in `dependencies`.
- `npm ls @electron/notarize @electron/fuses` reports both, in `devDependencies`.
- A subsequent `npm run build` does not warn about an unresolved import for any of them.

## Notes

- `electron-updater` MUST be a runtime dep. Putting it in devDeps will work in dev mode (where the updater is gated by `app.isPackaged`) and silently fail in the packaged build because it gets pruned.

