# SPIKE-002 — Does an unsigned NSIS auto-update via `electron-updater`?

**Milestone:** M2 (unblocks TASK-033's auto-update story)
**Owner:** DevOps
**Size:** S — 1-day timebox
**Depends on:** TASK-014 (to have an updater module to test)

## Question

By default, `electron-updater` performs `verifyUpdateCodeSignature` on Windows, which requires both the running app and the new artifact to be signed by a trusted publisher. v1 Windows is unsigned. Confirm whether:
- (a) the updater silently fails to find updates (worst — user is stuck and we never know).
- (b) the updater prompts but cannot install (medium — user gets a clear error).
- (c) some opt-out exists that we'd take only on an unsigned build (acceptable — gated by `app.isPackaged && !signed`).
- (d) something else.

## Method (timeboxed: 1 working day)

- On a Windows VM, install an unsigned v0.0.1 NSIS. Set up `update.electronjs.org`-equivalent feed (the GitHub provider configured in TASK-005).
- Push v0.0.2 to the test repo (also unsigned).
- Observe `userData/Mnemo/logs/main.log` for the updater's behaviour.
- Try variations: `verifyUpdateCodeSignature: false` (gated by an unsigned-build env var), and `disableWebInstaller: true`.

## Outputs

- A short markdown note covering the observed behaviour and the recommended approach for v1 unsigned Windows: most likely "no auto-update on Windows until M3; surface a 'Check for updates' link to GitHub Releases in the renderer banner."

## Decision triggered

- TASK-033's user-facing copy (and TASK-036's README Windows section) reflects the chosen approach.
- If `verifyUpdateCodeSignature: false` is the only viable path on unsigned builds, gate it strictly: only set false when `process.env.MNEMO_UNSIGNED === '1'`, set in CI for the unsigned Windows leg only. NEVER on macOS.

