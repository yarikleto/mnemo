# Release runbook

> The maintainer-facing playbook for every Mnemo release.

## Pre-flight (per release)

- All open PRs merged, `main` is green: `npm run typecheck && npm run test && npm run build` clean.
- CHANGELOG updated (or release notes drafted in the GitHub Release UI).
- README's "Installation → Updates" section still matches reality (e.g. when M3 lands, flip Windows from "manual" to "in-app banner").

## The cut

```bash
# 1. Bump version. semver-major for breaking schema migrations only.
npm version 0.0.2          # writes package.json + tags v0.0.2

# 2. Push the tag — this is the trigger for the release workflow.
git push origin main --follow-tags
```

The `release.yml` workflow takes ~12 minutes end-to-end:

| Leg | Duration | Output |
| --- | --- | --- |
| macos-14 (signed + notarized) | ~9 min | `.dmg`, `.zip`, `latest-mac.yml`, `.blockmap` |
| windows-latest (unsigned NSIS) | ~5 min | `Mnemo-Setup-X.Y.Z.exe`, `latest.yml`, `.blockmap` |
| ubuntu-24.04 (AppImage + .deb) | ~6 min | `.AppImage`, `.deb`, `latest-linux.yml`, `.blockmap` |

The legs run in parallel; the slowest leg gates publication.

## Verifying a draft release

The workflow publishes a **draft** GitHub Release. Before flipping it to published:

1. Download `Mnemo-X.Y.Z-universal.dmg` from the draft.
2. On a fresh Mac (or a wipeable VM / clean account): double-click → drag to Applications → launch.
3. Confirm: no Gatekeeper prompt; no "downloaded from the internet" warning; first-run lands on `/onboarding`.
4. From a terminal: `spctl --assess --verbose=4 /Applications/Mnemo.app` should print `accepted; source=Notarized Developer ID`.
5. From a terminal: `xcrun stapler validate /Applications/Mnemo.app` should print `The validate action worked!`.
6. Repeat the install on Windows + Linux (smoke only — SmartScreen click-through expected on Windows; AppImage `chmod +x` expected on Linux).

If all four legs pass, hit **Publish release** in the GitHub UI. The auto-updater starts seeing the new version within 6 hours of the next `tick()` (or instantly, if the user has restarted the app since `app.whenReady()` + 30 s).

## Re-running a failed leg

GitHub Actions → release run → **Re-run failed jobs**. Each leg is idempotent (`npm ci` is deterministic, electron-builder skips already-uploaded artifacts unless asked otherwise via `--publish always` which we use).

If a notarization step fails:

- Apple notary service has occasional outages; check [https://developer.apple.com/system-status/](https://developer.apple.com/system-status/).
- Re-run the macOS leg only.
- If it fails twice on different days, the cert may have expired or the App-Specific Password may have been revoked — re-issue and update the GitHub repo secret.

## Round-trip rehearsal protocol (TASK-018)

Run this once per **major** release to verify the in-app updater works end-to-end:

1. Cut `vX.Y.Z-rc1`. Wait for publish-as-draft.
2. Manually flip the draft to published.
3. On a fresh Mac, install the rc1 .dmg.
4. Launch. Wait 30 s + 6 h, OR force the check via the dev console: `await window.api.restartToInstall()` is the wrong primitive (that's the "after-download" verb); for the pre-download check, restart the app and watch `logs/main.log` for `[updater] checkForUpdatesAndNotify`.
5. Cut `vX.Y.Z-rc2`. Wait for publish-as-draft → publish.
6. The running rc1 instance should surface the "Mnemo X.Y.Z-rc2 is ready" banner within ~6 h (or restart sooner to bypass the poll interval).
7. Click **Restart now**. App relaunches into rc2. Confirm `app.getVersion()` matches via Help → Copy Diagnostics.

If steps 6 or 7 fail, the rc artifact does NOT promote to a real `vX.Y.Z` tag. Diagnose first.

## Rollback

There is no remote auto-rollback (we don't run a release server; the truth is GitHub Releases). If a release is broken:

1. **Unpublish or delete the broken release on GitHub.** New users stop downloading it.
2. **Affected users keep their existing version** — the auto-updater only ever moves forward, so even if `latest-mac.yml` points at the broken release, users on that version are stuck until you publish a fix.
3. **Cut the fix as `X.Y.(Z+1)`.** The next polling cycle pulls users forward.
4. **Avoid the temptation to "fix in place" by editing the broken release's assets.** electron-updater caches signatures and version maps; in-place edits cause "stuck on bad version" reports.

## Apple Developer cert renewal

Developer ID certs are valid 5 years. Calendar reminder ~30 days before expiry. Renewal:

1. Apple Developer portal → Certificates → renew Developer ID Application.
2. Export new `.p12` from Keychain Access.
3. Update `MAC_CSC_LINK` (base64 of the .p12) and `MAC_CSC_KEY_PASSWORD` repo secrets.
4. Cut a `vX.Y.Z-cert-renewal-rc1` to confirm the new cert signs and notarizes; promote.
