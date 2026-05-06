# TASK-002 — Developer ID `.p12` export + app-specific password

**Milestone:** M0
**Owner:** DevOps (handoff guide) → Client (export + password generation)
**Size:** S
**Status:** **BLOCKED on client action**
**Depends on:** TASK-001

## Goal

Get the cryptographic material the CI signing pipeline needs: a base64-encoded `.p12` of the Developer ID Application cert (private key + cert), the cert's export password, an app-specific password from appleid.apple.com for `notarytool`, and the Team ID — all captured in a form ready to paste into GitHub Actions secrets.

## Out of scope

- Storing the secrets (TASK-003).
- Using them in CI (TASK-008, TASK-009).

## Plan

- DevOps writes `.claude/handoff/developer-id-export.md` with screenshots / step-by-step for: opening Keychain Access, locating the Developer ID Application cert, exporting as `.p12` with a strong password, base64-encoding it (`base64 -i cert.p12 | pbcopy`), generating an app-specific password at appleid.apple.com → "Sign-In and Security" → "App-Specific Passwords", and copying the Team ID from the Apple Developer membership page.
- Doc explicitly warns: do not paste the regular Apple ID password anywhere; `notarytool` requires the app-specific one.
- Doc explicitly warns: store the `.p12` export password in a password manager — losing it means re-issuing the cert.

## Acceptance

- Client confirms they have all five values captured in their password manager: `MAC_CSC_LINK` (base64 of `.p12`), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- The handoff doc is concrete enough that a non-DevOps person can follow it.

## Notes

- The cert and the `.p12` password are the only Apple-issued material that cannot be regenerated cheaply if lost. Treat as crown jewels.

