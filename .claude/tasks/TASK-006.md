# TASK-006 — `hardenedRuntime: true` + `entitlements.mac.plist`

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** —

## Goal

Make the macOS build eligible for notarization. Notarization (post-2020) requires hardened runtime; without the flag and the right entitlements, the notary service rejects the app and TVC-A2 fails.

**Verifies:** prerequisite for TVC-A1, TVC-A2, TVC-A3. Trace: VC-1.

## Out of scope

- The actual `afterSign` notarize call (TASK-009).
- Signing config (TASK-008).

## Plan

- Add `hardenedRuntime: true` to the `mac` block of `electron-builder.yml`.
- Author `build/entitlements.mac.plist` with the entitlements Chromium / V8 / native modules need under hardened runtime: `com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`. Do NOT disable library validation unless a build break later forces it.
- Reference the plist via `mac.entitlements: build/entitlements.mac.plist` and `mac.entitlementsInherit: build/entitlements.mac.plist`.
- Confirm `build/` does not collide with anything else; the directory is conventional for electron-builder hooks and assets.

## Acceptance

- `electron-builder.yml` `mac` block contains `hardenedRuntime`, `entitlements`, and `entitlementsInherit`.
- `build/entitlements.mac.plist` exists, valid plist syntax, only the three keys above.
- A local unsigned `npm run dist:mac` still produces a runnable `.app` (the runtime is hardened but unsigned bypasses notarization).

## Notes

- Library validation is off by default and we do NOT add `com.apple.security.cs.disable-library-validation`. electron-builder signs the bundled Electron frameworks with our identity, which keeps library validation passing.

