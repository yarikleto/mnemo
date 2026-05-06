# SPIKE-002 — Auto-update behaviour on unsigned Windows NSIS

> Time-boxed: 1 day. Resolves whether v1 Windows users get auto-update or a manual-download flow until M3.

## Question

Does an unsigned Windows NSIS build refuse to auto-update due to signature verification?

## Findings (research-tier; confirm with a real round-trip on a Win 11 VM)

- `electron-updater` defaults to `verifyUpdateCodeSignature: true`. On Windows it validates that the **publisher** of the downloaded NSIS installer matches the publisher of the currently-running .exe (via the embedded Authenticode certificate's `Subject`).
- An unsigned-build → unsigned-build update has **no publisher to compare**: the verifier sees `null === null` and the check effectively becomes a no-op rather than a hard fail. In practice, `electron-updater` continues with the update.
- This is not the same as Apple's notarization gate — Windows doesn't refuse to install an unsigned update; it just makes the user click through SmartScreen on each install (same prompt as the initial install).
- Caveat: the moment we sign **one** NSIS build (post-M3) the first auto-update from the last unsigned to the first signed version will fail the publisher check, because `null !== "Yarik Leto"`. We need a one-time bridge: either ship the first signed version with `--publish never` and email users a manual link, OR temporarily set `verifyUpdateCodeSignature: false` for a single release. **Pick the manual-link approach** — disabling signature verification is a footgun.

## Decision

- **v1 Windows users DO get auto-update**, but with a SmartScreen click-through on every install. Document this in the README's Updates section.
- **The unsigned → signed transition (M3 fast-follow)** is a manual download, communicated in the release notes. After that, signed → signed auto-update works silently.
- **Never disable `verifyUpdateCodeSignature`.** It is the canonical mitigation against a compromised release pipeline and the cost of disabling is invisible until exploitation.

## Open follow-ups

- Confirm with a real test: take a v0.0.1-rc artifact, install on a Win 11 VM, push a v0.0.2-rc, observe the in-app update banner appear and the install round-trip.
- When TASK-FF-1 (Azure Trusted Signing) lands, draft the migration release notes referencing this spike.
