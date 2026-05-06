# TASK-018 — Cut `v0.0.2`: round-trip rehearsal of auto-update

**Milestone:** M0 — gate to declare the walking skeleton complete
**Owner:** DevOps + Manual-QA
**Size:** S
**Depends on:** TASK-014, TASK-015, TASK-017

## Goal

The release-day rehearsal that closes pre-mortem risk #2 ("auto-update breaks silently"). A real v0.0.1 instance, running on a fresh Mac, must observe a real v0.0.2 release on GitHub, download it, prompt the user, and become v0.0.2 after restart — all without manual intervention beyond clicking "Restart now."

**Verifies:** TVC-E1, TVC-E2, TVC-E3, TVC-E4. Trace: VC-5 (and VC-1 by the signature-verification leg).

## Out of scope

- Linux / Windows auto-update (covered by SPIKE-001 / SPIKE-002 + M2 tasks).
- Marketing-grade v1.0.0 (post-v1).

## Plan

- Keep the v0.0.1 install from TASK-017 running on the fresh Mac. Do not quit it.
- Bump `package.json#version` to `0.0.2`. No code changes — version bump only.
- Push `v0.0.2` tag. Release workflow fires; new artifacts appear in a new draft release.
- Flip the v0.0.2 draft to **Published** (this is the moment the updater sees the new version). The v0.0.1 draft can stay draft or get published — irrelevant.
- Within 30 minutes (the 30-second startup delay + the 6-hour interval — since v0.0.1 has been running, the startup check should already have fired; if not, wait for the next interval or quit + relaunch v0.0.1):
  - Watch `~/Library/Application Support/Mnemo/logs/main.log` for `Update available: 0.0.2`.
  - Watch for `Update downloaded: 0.0.2`.
  - Watch the running app for the renderer banner.
  - Confirm `userData/logs/updater.log` shows `verifyUpdateCodeSignature` ran and matched (TVC-E4).
- Click "Restart now" in the banner. Confirm the app quits and relaunches.
- After relaunch, confirm `app.getVersion()` is `0.0.2` (visible in About dialog from the macOS menu — TASK-028, or via `npx electron-debug` in dev mode).
- Document the run in the release-runbook. **This is the M0 gate.**

## Acceptance

- TVC-E1, E2, E3, E4 all pass on real artifacts.
- Manual-QA signs off: M0 walking skeleton complete. We can now ship v1.0.0 against a working pipeline.

## Notes

- This rehearsal MUST run before any v1.0.0 tag. The point of v0.0.1 / v0.0.2 is to surface signing-scope or `latest.yml` URL mismatches with zero user impact, in a tag we can throw away if needed.
- If the round-trip fails, do NOT skip ahead to v1.0.0. Diagnose, fix, cut v0.0.3, re-run. The pre-mortem is explicit: v1.0.0 is gated on this passing.

