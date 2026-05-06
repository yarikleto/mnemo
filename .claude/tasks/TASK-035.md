# TASK-035 — Playwright e2e suite: onboarding, window-restore, live-edit, offline

**Milestone:** M2
**Owner:** Tester
**Size:** S (per spec — kept tight; if any single suite balloons, split it)
**Depends on:** TASK-022, TASK-024, TASK-025

## Goal

Cover the user-visible flows that ADR-008, ADR-010, and the live-watcher + offline VCs depend on, in `electron-playwright-helpers` against the dev build (the round-trip rehearsal is manual and lives in TASK-018).

**Verifies:** TVC-B1 (no-config → /onboarding), TVC-C2 (live external-edit appears in <1500 ms), TVC-D1 (size restore), TVC-D3 (lastRoute restore), TVC-F1 (offline launch + review). Trace: VC-2, VC-3, VC-4, VC-6.

## Out of scope

- Auto-update e2e (the real round-trip is in TASK-018, manual on signed artifacts; mocking auto-update is brittle and adds little signal).
- Visual regression.

## Plan

- Add four new spec files under `tests/e2e/` (or wherever the existing Playwright config points):
  - `onboarding.spec.ts` — launch with `userData/` mocked to fresh; expect URL hash `#/onboarding`; click "Use the default"; assert URL hash advances to `#/review` and `cards/` + `state/` exist on disk.
  - `live-edit.spec.ts` — launch on a vault with one card; from the test runner, `fs.writeFile` a new card directly into the vault; assert the browse list updates within 1500 ms.
  - `window-state.spec.ts` — launch, resize via `electron.evaluate(({ BrowserWindow }) => …)`, quit, relaunch, assert bounds restored. Also: visit `/dashboard`, quit, relaunch, assert URL hash is `#/dashboard`.
  - `offline.spec.ts` — launch with the network blocked at the OS level (or by stubbing `net.fetch`); assert the review screen loads and a card can be rated. Skip the auto-update assertion (it should fail to reach GitHub, which is fine — TVC-F1 is about the review flow, not the updater).
- Update `package.json#scripts.e2e` if needed; current is `"e2e": "playwright test"` so spec discovery is automatic.
- Add `tests/e2e/README.md` documenting how to run a single spec, how the `userData/` reset works, and the expected duration (~30 s suite total).

## Acceptance

- All four specs pass on a fresh `npm run e2e`.
- A red spec on a regression genuinely points at the regressed area (no flaky timing-only assertions).

## Notes

- This task replaces the auto-update mock e2e suggestion in the architect's brief — mocked auto-update has consistently been a high-flake / low-value test. The real signal is in TASK-018's manual round-trip.

