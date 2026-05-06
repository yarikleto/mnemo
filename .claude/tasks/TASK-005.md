# TASK-005 — Add `publish: github` block to `electron-builder.yml`

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** —

## Goal

Tell electron-builder where to publish artifacts and where `electron-updater` will look for them: GitHub Releases on `yarikleto/mnemo`. Without this, the release workflow has nothing to push to and the updater has no feed.

**Verifies:** prerequisite for TVC-E1–E4. Trace: VC-5.

## Out of scope

- The CI job that uses it (TASK-016).
- `latest.yml` consumption by the updater (TASK-014).

## Plan

- Add a `publish` top-level block to `electron-builder.yml` with `provider: github`, `owner: yarikleto`, `repo: mnemo`. The provider auto-emits `latest.yml`, `latest-mac.yml`, `latest-linux.yml` next to the artifacts during `--publish always`.
- Confirm the existing `directories.output: out` does not need adjustment.
- Leave `mac.target`, `win.target`, `linux.target` as-is for now — TASK-007 changes the mac target to universal.

## Acceptance

- `electron-builder.yml` has a `publish` block whose three keys match the repo coordinates.
- `npm run dist:mac` (locally, unsigned) still succeeds — the publish step is a no-op without `--publish always`.

## Notes

- The `provider: github` choice is final per ADR-006 / ADR-011. Do not introduce S3 / generic / Bintray providers — they are out of scope.

