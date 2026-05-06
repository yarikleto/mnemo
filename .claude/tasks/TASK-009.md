# TASK-009 — `afterSign` hook: `@electron/notarize` + staple

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-004, TASK-008

## Goal

After every `.app` is signed, submit it to Apple's notary service via `notarytool` (using `@electron/notarize`), wait for the ticket, and let electron-builder staple the ticket onto the `.dmg`. Without this, Gatekeeper still warns even on signed apps; VC-1 fails.

**Verifies:** TVC-A2 (`spctl --assess` accepted), TVC-A3 (`stapler validate` works). Trace: VC-1.

## Out of scope

- The cert and entitlements (TASK-006, TASK-008).
- CI plumbing (TASK-016).

## Plan

- Author `build/notarize.cjs` (CommonJS — electron-builder hooks run as CJS by convention). The hook:
  - Reads `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` from `process.env`. Returns early (no-op) if `APPLE_ID` is unset, so local unsigned builds keep working.
  - Calls `notarize({ tool: 'notarytool', appPath, appleId, appleIdPassword, teamId })` from `@electron/notarize`.
  - Logs progress so the CI log shows "submitted", "waiting", "succeeded".
- Reference the hook from `electron-builder.yml`: `afterSign: build/notarize.cjs`.
- Stapling: electron-builder runs `xcrun stapler staple` on the `.dmg` automatically when notarization succeeds. No extra hook needed.
- Test path: a local build with the env vars set should produce a `.dmg` where `xcrun stapler validate <dmg>` reports `The validate action worked!` and `spctl --assess --type execute --verbose=4 <Mnemo.app>` reports `accepted`, `source=Notarized Developer ID`.

## Acceptance

- `build/notarize.cjs` exists and is referenced from `electron-builder.yml`.
- A locally signed + notarized DMG passes both `spctl` and `stapler validate`. **TVC-A2 and TVC-A3 pass locally.**

## Notes

- `@electron/notarize`, NOT the deprecated `electron-notarize`. Same authors, renamed.
- `notarytool`, NOT the deprecated `altool`. The latter has been removed in current Xcode versions.
- The hook MUST be silent / no-op when `APPLE_ID` is missing — that keeps `npm run dist:mac` working on any developer's machine for a quick unsigned smoke build.

