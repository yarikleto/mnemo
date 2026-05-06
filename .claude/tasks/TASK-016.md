# TASK-016 — `.github/workflows/release.yml` skeleton with macos-14 leg

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-003, TASK-005, TASK-008, TASK-009, TASK-013

## Goal

Stand up the GitHub Actions release workflow that fires on `v*` tag push, runs the build matrix, and publishes a draft GitHub Release with all artifacts. v1 ships the macos-14 leg; Windows + Linux legs land in TASK-033 / TASK-034 (M2).

**Verifies:** prerequisite for TVC-A1–A3 in CI (not just locally), TVC-E1–E4 (auto-update needs a real release artifact). Trace: VC-1, VC-5.

## Out of scope

- Windows leg (TASK-033).
- Linux leg (TASK-034).
- The actual v0.0.1 release tag (TASK-017).

## Plan

- Create `.github/workflows/release.yml`. Triggers: `on: push: tags: ['v*']` and `workflow_dispatch`.
- One job, matrix dimension `os: [macos-14]` for v1; M2 expands to `[macos-14, windows-latest, ubuntu-24.04]`. Keep the matrix shape so M2 is purely additive.
- Per job:
  - `actions/checkout@v4`.
  - `actions/setup-node@v4` with `node-version: '20'` and `cache: 'npm'`.
  - `npm ci` (NOT `npm install`).
  - `npm run typecheck && npm run test && npm run build`.
  - `npm run dist:mac -- --publish always` for the macOS leg (uses electron-builder's GitHub publish, draft release).
- Env vars exposed to the macOS job ONLY: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` from `${{ secrets.* }}`. `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` shared.
- Set the workflow to `permissions: contents: write` so the auto-injected token can publish releases.
- Author `.claude/handoff/release-runbook.md` (the second, lighter handoff doc) listing: how to cut a tag, how to re-run a failed job, how to flip a draft release to published, how the round-trip rehearsal protocol works.

## Acceptance

- Pushing a `v0.0.1-rc1` tag triggers the workflow on macos-14, runs through to publish, and a draft GitHub Release shows up with `Mnemo-0.0.1-rc1-universal.dmg`, `Mnemo-0.0.1-rc1-universal.zip`, `latest-mac.yml`, plus their `.blockmap` siblings.
- `Mnemo-0.0.1-rc1-universal.dmg`, downloaded from the draft release, passes `spctl --assess` and `stapler validate` on a fresh Mac.

## Notes

- `--publish always` is essential — without it, electron-builder builds artifacts locally and never uploads. Using `--publish onTag` is also valid but `always` keeps the workflow shape simpler since the trigger already gates on tag.
- Draft (not published) is intentional. The maintainer reviews artifacts before flipping to published, which is the moment the auto-updater starts seeing the new version.

