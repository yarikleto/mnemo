# TASK-007 — Universal mac target (arm64+x64)

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** SPIKE-003 (single-runner universal build viability)

## Goal

Ship a single `.dmg` that runs natively on both Apple Silicon and Intel Macs. Avoids forcing users to know which arch they're on, and halves the GitHub Releases artifact count.

**Verifies:** prerequisite for VC-1 (clean install on any Mac).

## Out of scope

- The CI runner choice (TASK-016).

## Plan

- Replace `mac.target: [dmg, zip]` with explicit `arch: [universal]` per target: `[{ target: dmg, arch: [universal] }, { target: zip, arch: [universal] }]`.
- Verify locally: `npm run dist:mac` produces a `Mnemo-X.Y.Z-universal.dmg`. The `lipo -info` of the `.app/Contents/MacOS/Mnemo` binary should report both arm64 and x86_64 slices.
- Confirm asset size: universal DMG is ~2× the single-arch DMG (~250 MB). Acceptable; this is a desktop app, not a mobile bundle.

## Acceptance

- Built DMG name includes `universal`.
- `lipo -info` confirms both arches present in the main binary.
- App launches cleanly on at least one arm64 Mac (the maintainer's primary).

## Notes

- SPIKE-003 verifies that `macos-14` runner can produce this without needing a separate `macos-13` x64 runner. If SPIKE-003 finds a regression, we add the second runner — but the configuration here does not change.

