# TASK-017 — Cut `v0.0.1`: signed + notarized + fuses verified

**Milestone:** M0
**Owner:** DevOps + Manual-QA (verification)
**Size:** S
**Depends on:** TASK-016

## Goal

Produce the first real signed, notarized, fuses-locked Mnemo build and verify it on a fresh Mac. Not a feature release; a pipeline release that proves every step of M0 works end-to-end before TASK-018 attempts the auto-update round-trip.

**Verifies:** TVC-A1, TVC-A2, TVC-A3, TVC-A4 on a real artifact (not just locally). Trace: VC-1.

## Out of scope

- Auto-update round-trip (TASK-018 — needs v0.0.2 to exist).
- v1.0.0 marketing-grade release (post-M3 work).

## Plan

- Bump `package.json#version` to `0.0.1`.
- Push a `v0.0.1` tag to `main`. The release workflow fires.
- Verification protocol on a fresh Mac (or a clean macOS account / a `~/Library/Application Support/Mnemo/`-wiped session):
  1. Download `Mnemo-0.0.1-universal.dmg` from the draft release.
  2. `codesign -dv --verbose=4 /Volumes/Mnemo/Mnemo.app` — expect `Authority=Developer ID Application: <Org> (<TEAMID>)` chain.
  3. `spctl --assess --type execute --verbose=4 /Volumes/Mnemo/Mnemo.app` — expect `accepted` and `source=Notarized Developer ID`.
  4. `xcrun stapler validate Mnemo-0.0.1-universal.dmg` — expect `The validate action worked!`.
  5. `npx @electron/fuses read /Volumes/Mnemo/Mnemo.app/Contents/MacOS/Mnemo` — expect the 8-row table from ADR-012.
  6. Drag to /Applications, launch from Spotlight. **Zero scary warnings.**
  7. Confirm onboarding flow appears (assumes M1 onboarding has shipped — if not, the empty `/review` is acceptable for v0.0.1 since this release is purely pipeline-focused).
- Document the run in the release-runbook handoff doc.

## Acceptance

- All four `TVC-A*` checks pass on the v0.0.1 artifact.
- Manual-QA confirms a launch from Spotlight on a fresh Mac shows zero Gatekeeper / notarize warnings.

## Notes

- v0.0.1 is intentionally not a marketing release. Its job is to make TASK-018 possible. Keep the changelog empty or just "Pipeline rehearsal — first signed build."
- If any TVC-A* fails, the right move is to fix the failing piece (e.g. revisit TASK-009 if `spctl` reports `unsigned` source) and re-tag as `v0.0.1-rc2` rather than chasing it under the v0.0.1 tag.

