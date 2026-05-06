# SPIKE-003 — Can `macos-14` arm64 runner produce a universal DMG that runs natively on Intel?

**Milestone:** M0 (unblocks TASK-007 and TASK-016 Mac matrix shape)
**Owner:** DevOps
**Size:** S — 1-day timebox
**Depends on:** —

## Question

ADR-011 assumes a single `macos-14` runner can produce `mac.target: { arch: [universal] }` via electron-builder's universal build, and that the result runs natively on both arm64 and x64 (Intel) Macs without a separate `macos-13` x64 runner. Verify before TASK-016 commits to a single-runner Mac matrix.

## Method (timeboxed: 1 working day)

- On a `macos-14` GitHub Actions runner (or local arm64 Mac as a proxy), run `npm run dist:mac` with the universal target config from TASK-007.
- `lipo -info out/mac-universal/Mnemo.app/Contents/MacOS/Mnemo` should report `Architectures in the fat file: ... are: x86_64 arm64`.
- Copy the universal DMG to an Intel Mac (or use Apple's Intel emulation under Rosetta 2 — the latter does not prove native x64 launch, only emulated, so an actual Intel machine is preferable).
- Launch from Spotlight; confirm Activity Monitor reports the process as `Apple` (arm64) on M-series and `Intel` (x86_64) on Intel.

## Outputs

- A short markdown note confirming or denying. If denied, the fallback is a 2-leg Mac matrix (`macos-14` for arm64, `macos-13` for x64), with electron-builder's per-arch DMG output.

## Decision triggered

- TASK-016's matrix is single-runner if positive, two-runner if negative. The cost of two-runner is 5 minutes of extra CI per release; not catastrophic.

