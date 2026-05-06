# TASK-008 — Wire `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` into electron-builder mac signing

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-003, TASK-006

## Goal

Make electron-builder pick up the Developer ID Application certificate from the GitHub Actions secrets at build time, sign every binary in the bundle with it, and produce a fully signed `.app` and `.dmg` ready for notarization.

**Verifies:** TVC-A1 (codesign chain reports Developer ID Application). Trace: VC-1.

## Out of scope

- Notarization (TASK-009).
- The CI job that exposes the env vars (TASK-016).

## Plan

- electron-builder reads `CSC_LINK` and `CSC_KEY_PASSWORD` (or the platform-prefixed `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD`) from the environment automatically. No `electron-builder.yml` change is needed if the env var names match.
- Confirm the mac block already has `identity` either unset (electron-builder will pick the first Developer ID Application cert in the keychain decoded from the `.p12`) or explicitly `${env.APPLE_TEAM_ID}` for clarity. Prefer auto-detect for v1.
- Locally: a developer with the cert installed should be able to set `CSC_LINK=$(base64 -i cert.p12)` and `CSC_KEY_PASSWORD=...` and run `npm run dist:mac`; the resulting `.app` passes `codesign --verify --verbose=4`.
- Document in `.claude/handoff/release-runbook.md` (created in TASK-016) the env var → secret mapping.

## Acceptance

- A locally driven build with the env vars set produces a signed `.app` whose `codesign -dv --verbose=4` reports `Authority=Developer ID Application: <Org Name>`. **TVC-A1 passes locally.**

## Notes

- The CI matrix (TASK-016) is where these env vars get plumbed from `${{ secrets.* }}`. This task only ensures the build config consumes them.

