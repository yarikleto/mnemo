# TASK-021 — Backward-compat: existing user is auto-onboarded silently

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-020

## Goal

Don't show the onboarding screen to the maintainer (or any existing user) on the first v1 launch after the upgrade. If config already has a real `rootPath` pointing to a directory containing `cards/`, treat them as onboarded and silently write the timestamp.

**Verifies:** regression-mitigation for risk #3 in `system-design.md` §8 (introducing onboarding regresses existing users).

## Out of scope

- The picker (TASK-019).
- The first-run screen (TASK-022).

## Plan

- In `loadConfig` (or a new `migrateConfigIfNeeded` helper called immediately after `loadConfig`):
  - If `config.onboardedAt == null` AND `config.rootPath` is non-empty AND `fs.existsSync(path.join(config.rootPath, 'cards'))`:
    - `patchConfig({ onboardedAt: new Date().toISOString() })`.
    - Skip the picker; the renderer's `init()` will see a valid `onboardedAt` and route to `/review` normally.
- The renderer's `useAppStore.init` (TASK-022) has the corresponding gate: `if (!config.onboardedAt || !config.rootPath) navigate('/onboarding')`.

## Acceptance

- A test fixture with a pre-v1 config (no `onboardedAt` field, valid `rootPath`, `cards/` present) loads, gets an `onboardedAt` written silently, and the renderer goes straight to `/review`.
- A test fixture with `onboardedAt == null` and a missing or empty `cards/` directory routes to `/onboarding`.

## Notes

- This is the cheap insurance that the maintainer's daily-driver session is not interrupted by an onboarding screen on the first v1 launch. The pre-mortem (§8 risk #3) calls this out as a release-blocking regression risk.

