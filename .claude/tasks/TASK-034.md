# TASK-034 — `ubuntu-24.04` job: AppImage + `.deb`

**Milestone:** M2
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-016, SPIKE-001

## Goal

Add the Linux leg so every `v*` tag also produces an AppImage and a `.deb` in the GitHub Release. AppImage is the universal binary; `.deb` covers Ubuntu / Debian apt installs.

**Verifies:** Best-effort Linux distribution. Trace: vision §"Target Platforms".

## Out of scope

- Snap / Flatpak (out of scope per vision §"Distribution Channels").
- Code signing (Linux is unsigned forever).

## Plan

- Add `ubuntu-24.04` to the matrix. Per-job step: `npm run dist:linux -- --publish always`.
- The current `linux.target: [AppImage, deb]` already covers both; no `electron-builder.yml` change needed.
- AppImage auto-update behaviour depends on SPIKE-001's outcome. If positive, no extra config; if negative, document a manual-download path until v1.x.

## Acceptance

- A `v0.0.x-rc` tag push produces a `Mnemo-0.0.x.AppImage` and a `mnemo_0.0.x_amd64.deb` in the draft GitHub Release.
- AppImage is `chmod +x`-executable on a fresh Ubuntu 24.04 LTS install; launches and reaches `/onboarding`.
- `.deb` installs cleanly via `sudo dpkg -i mnemo_*.deb` (manual smoke; not CI-enforced).

## Notes

- SPIKE-001 needs to land before this is finalised — it informs the auto-update story for Linux users.

