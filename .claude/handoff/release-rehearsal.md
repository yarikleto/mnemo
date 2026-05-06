# Release Rehearsal — v0.0.1 → v0.0.2 Auto-Update Round-Trip

> For: Mnemo maintainer | Created: 2026-05-06 | Status: PENDING
> **Blocks:** Tagging v1.0.0. ADR-006 makes this rehearsal a hard release gate. Pre-mortem risk #2 ("auto-update breaks silently") is addressed only by passing this rehearsal on real packaged builds — not in dev mode, not in tests.

## Why This Is Needed

`electron-updater` is well-trodden, but **every project's first release-day rehearsal surfaces something** — a `latest.yml` URL mismatch, a signing-scope problem, a channel-name typo, a permission gap on the GitHub token. The first time you find any of these, you want it to be on a `v0.0.x` tag with no users — not on `v1.0.0` with a paying audience (or, in Mnemo's case, the open-source friends-and-family beta).

The rehearsal proves all of:

- electron-builder uploads the right artifacts to GitHub Releases.
- `latest-mac.yml` correctly references the published `.dmg`.
- A real signed + notarized app on a real Mac picks up an update from GitHub Releases.
- `verifyUpdateCodeSignature` actually verifies (not silently bypassed).
- `quitAndInstall()` actually replaces the running binary.
- VC-5 ("a running Mnemo prompts the user to update within 24 hours and applies the update on next quit/relaunch") is achievable.

## Prerequisites

- [ ] `apple-developer-enrollment.md` — done; cert in keychain, app-specific password generated.
- [ ] `github-secrets.md` — done; all five Apple secrets + the auto-`GITHUB_TOKEN` set up.
- [ ] `electron-builder.yml` — has `publish: github`, `mac.hardenedRuntime: true`, `mac.entitlements`, `mac.target: [universal dmg + zip]`, `afterSign: build/notarize.cjs`, `afterPack: build/fuses.cjs`.
- [ ] `package.json` — `electron-updater@^6.3.9` in `dependencies`.
- [ ] `src/main/updater.ts` — implemented per ADR-006 (start updater on whenReady, IPC bridge for `update:ready`, settings toggle).
- [ ] `.github/workflows/release.yml` — implemented per ADR-011 (matrix, `--publish always`, draft release).
- [ ] **A "fresh" Mac** — either a real second Mac you own, or a wiped/spare account on your main Mac, or a clean Parallels/VMware macOS VM. The point is: **no `~/Library/Application Support/Mnemo/` directory before installing v0.0.1.** First-launch behavior must be virgin.

The rehearsal cannot be done on the same Mac you're developing on without first deleting `~/Library/Application Support/Mnemo/` and `~/Documents/mnemo/` (or whichever vault you've been using). **Recommend a separate user account** to avoid clobbering your real vault.

## Goal

Prove that:

1. A `v*` tag pushes a signed, notarized macOS `.dmg` to a draft GitHub Release.
2. After publishing the draft, a freshly-installed v0.0.1 copy on a clean Mac will:
   - Detect v0.0.2 within 30 minutes of polling.
   - Download v0.0.2 silently in the background.
   - Show the renderer's "update ready" banner.
   - On user-triggered quit-and-relaunch, run as v0.0.2.

## Protocol

### Step 1 — Tag and push v0.0.1

On `main`, after all prereqs above are met:

1. Bump `package.json` version to `0.0.1`. Commit with message `chore: bump to 0.0.1 for release rehearsal`.
2. Tag: `git tag v0.0.1`.
3. Push: `git push origin main --tags`.

### Step 2 — Watch the release workflow

1. Open https://github.com/yarikleto/mnemo/actions.
2. The "Release" workflow should appear, triggered by the tag push.
3. Three jobs run in parallel: `build (macos-14)`, `build (windows-latest)`, `build (ubuntu-24.04)`.
4. **macOS job** is the slow one (5–15 minutes; signing + notarization + waiting on Apple's notary servers).
5. While it runs, you can preview the draft release at https://github.com/yarikleto/mnemo/releases.

**If a job fails:**

- Check the failed step's logs.
- Common failures and where to look:
  - "No identity found" → `CSC_KEY_PASSWORD` wrong, or `CSC_LINK` malformed. See `github-secrets.md` troubleshooting.
  - "Notarization failed: status: Invalid" → check the notary log link in the error; usually `mac.hardenedRuntime` is missing or an entitlement is wrong.
  - "Notarization timeout" → Apple's notary servers are slow; re-run the workflow.
  - "Resource not accessible by integration" → `permissions: contents: write` missing in the workflow YAML.
- Fix the issue, push to main, re-tag (e.g. `v0.0.1` deletion + retag, OR bump to `v0.0.2`-as-rehearsal-1 — your call; for first-attempt rehearsals, retagging the same `v0.0.1` is fine since no users exist yet).

### Step 3 — Verify the draft release artifacts

Once all three jobs are green, the draft release at https://github.com/yarikleto/mnemo/releases shows:

- `Mnemo-0.0.1-universal.dmg` (~120 MB)
- `Mnemo-0.0.1-universal.zip`
- `Mnemo-0.0.1-universal-mac.zip.blockmap`
- `Mnemo-0.0.1-universal.dmg.blockmap`
- `latest-mac.yml`
- `mnemo_0.0.1_amd64.deb`
- `Mnemo-0.0.1.AppImage`
- `latest-linux.yml`
- `Mnemo Setup 0.0.1.exe` (NSIS installer)
- `latest.yml`

**Do not publish the draft yet.** First, verify the macOS artifact locally.

Download `Mnemo-0.0.1-universal.dmg` to your dev Mac. Run all three of these commands:

```bash
# Mount the dmg first
open ~/Downloads/Mnemo-0.0.1-universal.dmg
# Then in /Volumes/Mnemo/:

codesign -dv --verbose=4 /Volumes/Mnemo/Mnemo.app
# expect: Authority=Developer ID Application: <Your Name> (TEAMID)
#         Authority=Developer ID Certification Authority
#         Authority=Apple Root CA

spctl --assess --type execute --verbose=4 /Volumes/Mnemo/Mnemo.app
# expect: /Volumes/Mnemo/Mnemo.app: accepted
#         source=Notarized Developer ID

xcrun stapler validate ~/Downloads/Mnemo-0.0.1-universal.dmg
# expect: The validate action worked!

npx @electron/fuses read --app /Volumes/Mnemo/Mnemo.app
# expect: RunAsNode is Disabled
#         EnableCookieEncryption is Enabled
#         EnableNodeOptionsEnvironmentVariable is Disabled
#         EnableNodeCliInspectArguments is Disabled
#         EnableEmbeddedAsarIntegrityValidation is Enabled
#         OnlyLoadAppFromAsar is Enabled
#         LoadBrowserProcessSpecificV8Snapshot is Disabled
#         GrantFileProtocolExtraPrivileges is Disabled
```

If any of those fail: **delete the draft release**, fix the issue, re-tag, re-run. Don't proceed.

### Step 4 — Publish the draft release

In the GitHub Releases UI:

1. Open the draft `v0.0.1`.
2. Click "Edit".
3. Uncheck "Set as a pre-release" if checked (we want this on the `latest` channel).
4. Click **"Publish release"**.

This is the moment the release becomes the `latest` for `electron-updater` — but no clients exist yet, so nothing happens.

### Step 5 — Install v0.0.1 on the fresh Mac

On the **clean Mac** (or fresh user account):

1. Download `Mnemo-0.0.1-universal.dmg` from https://github.com/yarikleto/mnemo/releases.
2. Double-click. **No Gatekeeper warning** should appear (this validates VC-1).
3. Drag Mnemo to Applications.
4. Eject the DMG.
5. Launch Mnemo from Applications.
6. Onboarding screen appears (per ADR-008). Complete onboarding with the default vault path, OR pick a folder.
7. Reach `/review` (empty queue is fine).
8. **Leave the app running.**

Verify the app reports its own version. Open the Help menu → "Copy diagnostics" (or via DevTools console in main: `app.getVersion()`). Expected: `0.0.1`.

### Step 6 — Tag and push v0.0.2

Back on your dev Mac:

1. Bump `package.json` version to `0.0.2`. **No code changes.** Just the version field.
2. Commit: `chore: bump to 0.0.2 for rehearsal round-trip`.
3. `git tag v0.0.2`.
4. `git push origin main --tags`.
5. Wait for the workflow to finish and the draft release to appear.
6. **Verify the v0.0.2 artifact** with the same four `codesign` / `spctl` / `stapler` / `fuses` commands as Step 3.
7. **Publish the v0.0.2 draft release.**

### Step 7 — Wait for the running v0.0.1 to detect v0.0.2

On the **fresh Mac** (where v0.0.1 is still running):

1. Per ADR-006, `electron-updater` polls **30 seconds after launch**, then **every 6 hours**. For the rehearsal, **don't wait 6 hours** — restart Mnemo on the fresh Mac to trigger the 30-second poll. (Or temporarily lower the interval in `updater.ts` to 60 seconds for the rehearsal — but that requires a code change; restarting is simpler.)
2. Within ~30 seconds of relaunching v0.0.1, the auto-updater should hit GitHub, download `latest-mac.yml`, see `0.0.2`, and start downloading the new DMG.
3. Watch `~/Library/Application Support/Mnemo/logs/main.log` (or via the Help menu's "Copy diagnostics" item):
   ```
   info: Checking for update
   info: Update for version 0.0.2 is available
   info: Found version 0.0.2 (url: https://...universal-mac.zip)
   info: Downloading update from https://...
   info: New version 0.0.2 has been downloaded
   ```
4. The renderer should display the "Mnemo 0.0.2 is ready — restart to apply" banner.

### Step 8 — Quit and relaunch; verify version

1. Click the "Restart to apply" button in the banner (or Cmd-Q to quit; the queued update applies on quit).
2. Mnemo restarts.
3. Verify version: Help menu → "Copy diagnostics" should now show `0.0.2`.
4. Verify the vault path and onboarded state survived the upgrade — `/review` should still be reachable, the vault should still be the one chosen at v0.0.1.

If you see `0.0.2` and the vault is intact, **the rehearsal passed.** Document the rehearsal in the PR/commit log; tag v1.0.0 with confidence.

## Pass Criteria

All eight must hold:

- [ ] **PC-1.** v0.0.1 release workflow is green (all three OS jobs, signing + notarization passed).
- [ ] **PC-2.** v0.0.1 DMG passes `codesign -dv` (Developer ID Application chain).
- [ ] **PC-3.** v0.0.1 DMG passes `spctl --assess` (Notarized Developer ID).
- [ ] **PC-4.** v0.0.1 DMG passes `xcrun stapler validate`.
- [ ] **PC-5.** v0.0.1 fuses table matches ADR-012.
- [ ] **PC-6.** v0.0.1 launches on the fresh Mac with no Gatekeeper warning, reaches review screen ≤ 90 seconds (VC-1).
- [ ] **PC-7.** Running v0.0.1 detects v0.0.2 within 60 seconds of relaunch (or 6h normally), downloads, shows the "ready to install" banner.
- [ ] **PC-8.** After click-to-restart (or Cmd-Q + relaunch), `app.getVersion()` reports `0.0.2`. Vault and onboarded state intact.

## Failure Modes & Recovery

### F1 — Notarization fails

**Symptoms:** macOS job fails at `afterSign` with "Notarization failed: status: Invalid".

**Cause:** The notary log (linked from the error) names the offending binary. Usually:
- `hardenedRuntime: false` somewhere.
- An entitlement is wrong (e.g., requesting `com.apple.security.cs.allow-dyld-environment-variables` without need triggers a reject).
- A bundled native module (chokidar/fsevents) has timestamps Apple distrusts.

**Recovery:** Read the notary log, fix the cause, push to main, re-tag.

### F2 — `latest-mac.yml` URL doesn't match the published DMG

**Symptoms:** v0.0.1 detects v0.0.2 but download fails with 404.

**Cause:** electron-builder uploaded the manifest pointing at a path that doesn't exist (rare; usually a publish-config issue with `owner` or `repo` mismatched).

**Recovery:** Confirm `electron-builder.yml` has `publish: { provider: github, owner: yarikleto, repo: mnemo }`. Confirm `package.json` `name` matches the build artifact prefix. Re-tag.

### F3 — Update detected but signature verification fails

**Symptoms:** Log says `Update is not supported because the version of the running app is not signed properly` or `verifyUpdateCodeSignature failed`.

**Cause:** v0.0.1 and v0.0.2 were signed with different identities, OR `verifyUpdateCodeSignature` was disabled (don't ever do this), OR the publisherName/identity changed mid-rehearsal.

**Recovery:** Use the same Apple Developer ID Application cert across both versions. Confirm `MAC_CSC_LINK` hasn't been re-uploaded with a different cert in the middle.

### F4 — `quitAndInstall()` doesn't actually replace the binary

**Symptoms:** After Cmd-Q + relaunch, version still reports `0.0.1`.

**Cause:** macOS App Translocation — if you ran the app directly from `~/Downloads/` instead of `/Applications/`, macOS sandboxes it and `quitAndInstall` can't write to the actual binary. Or the user doesn't have write access to `/Applications/` (rare, but if Mnemo was installed system-wide via `sudo`).

**Recovery:** Drag-to-Applications properly, re-test. Don't run from Downloads.

### F5 — The auto-updater silently does nothing

**Symptoms:** No log entries about checking for updates. v0.0.1 happily sits at 0.0.1 forever.

**Cause:** `app.isPackaged === false` (running a dev build), OR the `Config.autoUpdate.enabled` toggle defaults off, OR the `updater.ts` module isn't actually called from `whenReady`.

**Recovery:** Confirm the running app is the packaged DMG (not `npm run dev`). Confirm settings show "Auto-update: enabled". Confirm logs show `info: Checking for update` at app start.

### F6 — Apple's notary servers are down / slow

**Symptoms:** macOS job hangs on `afterSign` for >30 minutes.

**Cause:** Apple-side outage (rare but real; check https://developer.apple.com/system-status/).

**Recovery:** Cancel the workflow run, retry later. Don't try to bypass notarization — VC-1 fails.

## What to do after a passing rehearsal

1. **Document in CEO brain** that the auto-update round-trip passed on `<date>` between v0.0.1 and v0.0.2.
2. **Delete the v0.0.1 and v0.0.2 releases** from the GitHub Releases page (they're no longer useful and clutter the version history). The tags can stay or also be deleted — your preference.
3. **Bump `package.json` back to whatever number you want for v1.0.0** (probably `1.0.0` itself). Push the bump on a feature branch + PR if you've moved to PR-based shipping by now; otherwise per `CLAUDE.md`'s direct-to-main pattern.
4. **Tag v1.0.0** when ready. The pipeline is identical to the rehearsal at this point.

## What to do after a failing rehearsal

Don't tag v1.0.0. Iterate on the failure mode, push fixes, re-rehearse with v0.0.3, v0.0.4, etc. The rehearsal is cheap; the cost of a botched v1.0.0 release is high (users stuck on a broken version with no path to fix).

## Rehearsal cadence after v1

After v1.0.0 ships, **every fifth release** should informally re-rehearse the round-trip on a fresh Mac. This catches drift (cert renewal, electron-updater upgrade, GitHub API change). Add it to a quarterly tickler.

A *failed* rehearsal post-v1 is a P0 — you have users who could be affected. Stop releases until fixed.
