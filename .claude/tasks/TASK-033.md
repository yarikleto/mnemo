# TASK-033 — `windows-latest` job in release workflow (unsigned NSIS)

**Milestone:** M2
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-016, SPIKE-002

## Goal

Add the Windows leg to the release workflow so every `v*` tag produces an unsigned `Mnemo Setup X.Y.Z.exe` in the GitHub Release. Best-effort, expected SmartScreen click-through documented in TASK-036.

**Verifies:** Best-effort Windows distribution. Trace: vision §"Target Platforms".

## Out of scope

- Code signing (deferred — TASK-FF-1, TASK-FF-2).
- Auto-update behaviour on unsigned NSIS (depends on SPIKE-002 outcome).

## Plan

- Add `windows-latest` to the matrix in `.github/workflows/release.yml`. Per-job step: `npm run dist:win -- --publish always`.
- Do NOT expose mac signing secrets to this job — apply secrets at the step level, not the workflow level, OR use a job-level `if: matrix.os == 'macos-14'` gate.
- Confirm `electron-builder.yml`'s `win.target: nsis` produces a working installer when run on `windows-latest`.

## Acceptance

- Pushing a `v0.0.x-rc` tag produces a `Mnemo-Setup-0.0.x.exe` in the draft GitHub Release.
- A Windows VM (or a dual-boot machine) installs the .exe, sees a SmartScreen warning, click-through "Run anyway", reaches `/onboarding` (or `/review` if the user's `userData/` already had a config).

## Notes

- SPIKE-002 informs whether the `electron-updater` flow can find updates against an unsigned binary, or whether v1 Windows users need a manual-download story until M3.

