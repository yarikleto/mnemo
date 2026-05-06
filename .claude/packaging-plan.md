# Mnemo Packaging Plan

> Version 1 — 2026-05-06
> **Status:** Mnemo v1 packaging plan derived from system-design.md ADRs 005, 006, 007, 011, 012, 014. macOS first-class signed+notarized; Windows+Linux unsigned at v1; Windows signing fast-follow.
>
> **What this document is.** The packaging + release pipeline as a single contract. Everything below traces back to an approved ADR; nothing here re-litigates a decision the architect already made. The developer agent uses this as the spec for the actual `electron-builder.yml` / `.github/workflows/release.yml` / `build/notarize.cjs` / `build/fuses.cjs` changes; the client (the user) uses the four `.claude/handoff/*.md` files for the things that need a human at a browser.
>
> **What this document is NOT.** The literal YAML/JS code. The architect's task breakdown drives implementation; this is the engineering plan that breakdown is built on.

---

## 1. Builder Choice

**electron-builder ^26 (existing).** Locked by ADR-005. Forge is explicitly ruled out.

The repo already ships `electron-builder.yml` producing `.dmg`, `.zip`, `.exe`, `.AppImage`, `.deb`. v1 work is **additive** to this file: an `afterSign` hook (notarization), an `afterPack` hook (fuses), `publish` config (GitHub provider), `mac.hardenedRuntime` + entitlements, and `mac.target` flipped to a **universal** build. We are not replacing the builder.

`electron-builder` ≥ 26 is the minimum for `azureSignOptions` on Windows (relevant only when the post-v1 fast-follow lands). The current pin `^26.8.1` is fine.

---

## 2. Signing Plan

### 2.1 macOS — Apple Developer ID + Notarization (v1, blocking)

Per ADR-007.

- **Certificate:** Apple Developer ID **Application** certificate. (NOT "Mac App Store" — that's a different identity for the App Store distribution channel, which we're not using; not "Developer ID Installer" — we don't ship a `.pkg`.)
- **Hardened runtime:** `mac.hardenedRuntime: true` in `electron-builder.yml`. Required for notarization since 2020; non-negotiable.
- **Entitlements:** `build/entitlements.mac.plist` referenced by both `mac.entitlements` and `mac.entitlementsInherit`. Minimum entitlements:
  - `com.apple.security.cs.allow-jit` — Chromium/V8 needs JIT.
  - `com.apple.security.cs.allow-unsigned-executable-memory` — V8 + native modules.
  - **Do not** disable library-validation; electron-builder signs all bundled frameworks itself, so library-validation should remain enforced.
  - **No** `com.apple.security.network.client` exception is needed for Mnemo today (the only network call is electron-updater in main; that's allowed for any non-sandboxed app outside MAS).
- **Universal binary:** `mac.target: [{ target: dmg, arch: [universal] }, { target: zip, arch: [universal] }]`. One artifact, both arm64 (M-series) and x64 (Intel). The CI matrix only needs one mac runner (`macos-14`) — no separate `macos-13` x64 job. (Verified against current electron-builder; if the universal-from-arm64 path ever regresses, ADR-011 has the fallback.)
- **Identity selection:** `mac.identity` left **unset** so electron-builder auto-picks the only Developer ID Application identity in the keychain after `CSC_LINK` import. Setting `identity: null` would *disable* signing — never do that in CI.
- **Signing inputs:** `CSC_LINK` (base64-encoded `.p12`) and `CSC_KEY_PASSWORD` env vars. electron-builder imports the `.p12` into a temporary keychain on the runner, signs, then discards it. Nothing persists on disk.

### 2.2 Windows — Deferred to Fast-Follow (v1 ships unsigned)

Per ADR-007. v1 produces an **unsigned** NSIS `.exe`. Users see a Microsoft SmartScreen "Windows protected your PC" warning on launch; the README's "Installation on Windows" section explains the workaround ("More info" → "Run anyway").

**Why deferred, not skipped:**

- **Post-June-2023 reality.** Public CAs no longer issue exportable code-signing keys for EV certificates. The cheap-EV-USB-token path (~$300 once, hardware dongle) is **closed** for new buyers. Surviving paths are all cloud-HSM-backed:
  - **Azure Trusted Signing** — Microsoft's managed signing service, ~$10/month plus tenant verification. electron-builder ≥ 25 has native `azureSignOptions` support. Eligibility requires US/Canada org with 3+ years of verifiable history (current as of 2025; Microsoft loosens this periodically).
  - **DigiCert KeyLocker** — cloud HSM accessed via `signtool` plugin. ~$300+/yr.
  - **SSL.com eSigner** — similar cloud HSM. ~$300+/yr.
  - Hardware-EV (YubiKey / eToken) is theoretically still possible from some boutique resellers, but it requires a human at the box during signing — incompatible with hosted GitHub runners.
- **SmartScreen reputation accumulates slowly even on signed binaries** — a fresh Trusted Signing cert starts with zero reputation, and most Windows users still see the warning until enough installs build trust. Buying the cert doesn't immediately make the warning disappear.
- **Audience signal.** The product vision (§"Target Platforms") says Windows is "best-effort" with a small initial audience. Spending ~$120/yr (Trusted Signing) before any Windows users surface is a poor allocation.

**The fast-follow plan** is in `.claude/handoff/windows-signing-fastfollow.md`. The trigger is: ≥ 5 prospective Windows users surface OR a SmartScreen warning is the #1 complaint in the GitHub issues for two consecutive weeks.

### 2.3 Linux — Unsigned Forever

AppImage + `.deb`, no signing. Audience expectations:

- **AppImage:** users `chmod +x Mnemo-X.Y.Z.AppImage` and run. Desktops with **AppImageLauncher** installed will offer to integrate the AppImage automatically (registers a `.desktop` entry, places under `~/Applications/`); users without AppImageLauncher see a transient confirmation dialog from their DE on first run. Document this in the README.
- **`.deb`:** users `sudo dpkg -i mnemo_X.Y.Z_amd64.deb` (or use a graphical installer). Works on Debian / Ubuntu / derivatives.

No `.rpm`, no Snap, no Flatpak at v1. (Vision §"Distribution Channels" is explicit: GitHub Releases only.)

---

## 3. Notarization

Per ADR-007. The pipeline is: sign → submit to Apple's notary service → wait for ticket → staple ticket onto the artifact.

- **Tool:** `@electron/notarize` (NOT the deprecated `electron-notarize` package — same binary name, different scope, different package name; the old one is unmaintained).
- **Underlying CLI:** `notarytool` (bundled with Xcode Command Line Tools 13+). The legacy `altool` was deprecated in 2022 and removed from current Xcode versions — explicitly do **not** use it.
- **Hook:** electron-builder's `afterSign` hook in `electron-builder.yml` points at `build/notarize.cjs`. The script:
  - Imports `@electron/notarize`.
  - Reads `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` from env.
  - Calls `notarize({ tool: 'notarytool', appPath, appleId, appleIdPassword, teamId })`.
  - Early-out (no-op) if `APPLE_ID` is unset — so `npm run dist:mac` on the maintainer's machine without secrets still produces an unsigned, un-notarized DMG for local testing.
- **Stapling:** electron-builder runs `xcrun stapler staple` on the `.dmg` and the `.app` automatically once notarization succeeds. **Always staple.** An un-stapled but notarized app re-checks Apple's notary servers on every first-launch — that's the worst UX (network-dependent launch, scary failure mode if Apple's servers are down).
- **Auth: app-specific password vs Notary API key.**
  - **Recommended for Mnemo:** **app-specific password.** Generated at appleid.apple.com → "App-Specific Passwords" — takes 30 seconds, no Apple Developer Console hoop-jumping. Three secrets total (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Recommended for solo maintainers.
  - **Alternative:** Notary API key. Three secrets (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`). Slightly higher security ceiling (revocable per-key in App Store Connect; the key is a `.p8` file, not a password). Worth the small extra setup if the cert lives at an org with multiple humans rotating keys. **For Mnemo (solo dev), the app-specific password is fine.**
- **Notarization can fail.** Common failure modes and what they mean:
  - "The signature of the binary is invalid." — A bundled framework (e.g. Squirrel, fsevents native module) wasn't signed. electron-builder normally handles this via `--deep`-equivalent recursive signing, but a custom `extraResources` entry could escape. Confirm the entitlements file has the right entries.
  - "The executable does not have the hardened runtime enabled." — `mac.hardenedRuntime: true` is missing.
  - "The binary uses an SDK older than the 10.9 SDK." — Electron 39 ships with a modern SDK; this would only happen if a dev manually swapped the Electron binary. Should not occur.
  - "Could not connect to Apple Notary service." — transient; CI workflow should retry once on failure (electron-builder doesn't retry automatically; the `afterSign` hook should `try/catch` the `notarize()` call and retry once with a 60-second delay).
- **Verification:** `xcrun stapler validate /path/to/Mnemo.app` should report `validated`. Also `spctl --assess --type execute --verbose=4 Mnemo.app` should report `accepted source=Notarized Developer ID`. These are TVC-A2 and TVC-A3.

---

## 4. Auto-Update

Per ADR-006. **`electron-updater` ≥ 6.3.9** against GitHub Releases (NOT `update.electronjs.org`'s built-in Squirrel updater; ADR-006 picked this for Linux AppImage support).

### 4.1 Configuration

- **New runtime dependency:** `electron-updater@^6.3.9` in `dependencies` (NOT devDependencies — ships in the packaged binary). The 6.3.9 floor pins past CVE-2024-39698, which let an attacker-controlled `latest.yml` bypass signature verification on macOS. Older versions are an RCE dispenser.
- **electron-builder publish config** in `electron-builder.yml`:
  ```yaml
  publish:
    provider: github
    owner: yarikleto
    repo: mnemo
  ```
- **Generated artifacts.** electron-builder, with `publish: github`, emits these alongside the binaries:
  - `latest.yml` (Windows)
  - `latest-mac.yml` (macOS)
  - `latest-linux.yml` (Linux AppImage)
  - `*.blockmap` (delta-update sidecar files; harmless even if deltas not used)
- **Module location:** new `src/main/updater.ts`. Exports `startAutoUpdater(win, config)` and `setupUpdaterIpc(win)`. Called from `app.whenReady().then(...)` after `createWindow`.
- **Critical:** `autoUpdater.verifyUpdateCodeSignature = true` — this is the default; **never disable.** It pins each update to the same Developer ID Application certificate that signed the running app. Skipping the check would let any attacker who can serve a tampered `latest.yml` deliver arbitrary code.
- **Dev-mode safety:** `if (!app.isPackaged) return;` early-out. The updater must be inert in `npm run dev`.
- **Cadence:** initial check 30 seconds after `whenReady`, then every 6 hours via `setInterval`. Vault-busy state has no impact — main-process work is non-blocking.
- **UX:** silent download. On `update-downloaded`, `webContents.send('update:ready', { version })`. Renderer shows a non-modal banner ("Mnemo X.Y.Z is ready — restart to apply"). User picks the moment. On `app.quit`, call `autoUpdater.quitAndInstall()` if an update is staged. **No silent restarts.**
- **Settings toggle:** `Config.autoUpdate.enabled: boolean` (default `true`). Surface in `/settings`. When off, never poll.
- **Logger:** `autoUpdater.logger = electronLog` (ADR-014). Writes to `userData/logs/main.log` so a stuck-on-old-version user can attach the log to a GitHub issue.

### 4.2 Channel Strategy

**v1: latest only.** No beta channel, no staged rollout. Single channel = single `latest.yml` = single binary stream. Simple.

**Future (v1.x):**
- **Beta channel.** electron-builder supports it via `releaseType: 'prerelease'` on the GitHub provider — any release tagged with a pre-release suffix (e.g., `v1.1.0-beta.1`) emits to a separate channel; `electron-updater` switches by setting `autoUpdater.channel = 'beta'`. Add when there are users willing to dogfood the unstable branch — likely never at v1's solo-maintainer scale.
- **Staged rollout.** electron-updater supports `stagingPercentage` per release. Worth adding when a single bad release would burn a non-trivial number of installs (i.e., when DAU > a few hundred). Premature at v1.

### 4.3 Round-Trip Rehearsal Gate

ADR-006 + the pre-mortem in product-vision (§3 risk #2) make a v0.0.1 → v0.0.2 round-trip a **hard gate** before tagging v1.0.0. The full protocol is in `.claude/handoff/release-rehearsal.md`. Summary: cut a `v0.0.1` tag, watch the release land in GitHub Releases, install on a fresh Mac, cut `v0.0.2` (no code change, just the version bump in `package.json`), watch the running v0.0.1 detect + download + apply on quit. If anything breaks, **do not tag v1.0.0** until the breakage is understood and re-tested.

---

## 5. Fuses

Per ADR-012. The fuse table, locked:

| Fuse | Value | Reason |
|---|---|---|
| `RunAsNode` | `false` | Disables `ELECTRON_RUN_AS_NODE`. A signed Mnemo binary cannot be hijacked into running arbitrary Node code via env-var. |
| `EnableCookieEncryption` | `true` | Cookies on disk are encrypted via OS keychain. Mnemo doesn't use cookies, but it's free defense-in-depth. |
| `EnableNodeOptionsEnvironmentVariable` | `false` | `NODE_OPTIONS=--require=/path/evil.js` no longer affects the signed binary. |
| `EnableNodeCliInspectArguments` | `false` | `--inspect`, `--inspect-brk`, `--remote-debugging-port` blocked in production. No covert debugger attach. |
| `EnableEmbeddedAsarIntegrityValidation` | `true` | Validates the embedded ASAR header SHA on every load. **Pairs mandatorily with `OnlyLoadAppFromAsar`.** |
| `OnlyLoadAppFromAsar` | `true` | Refuses to load an unpacked `app/` folder if the ASAR is missing. Defeats "swap a JS file" attacks. **Pairs mandatorily with `EnableEmbeddedAsarIntegrityValidation`.** |
| `LoadBrowserProcessSpecificV8Snapshot` | `false` | We don't ship a custom V8 snapshot. Set explicitly for clarity. |
| `GrantFileProtocolExtraPrivileges` | `false` | `file://` does NOT get extra privileges (back to standard origin behavior). Defense for the `mnemo-asset://` boundary. |

### 5.1 Order Matters: Pack → Fuse → Sign → Notarize

The fuses *modify* the Electron binary itself. If signing happens before fuses are flipped, the signature won't cover the fused binary, and `codesign --verify` will fail at install time. The required order is:

1. **electron-builder packs** (`afterPack` runs at the right point).
2. **`build/fuses.cjs`** runs as the `afterPack` hook — calls `flipFuses(appPath, { version: FuseVersion.V1, ...table })`. Modifies the binary in-place.
3. **electron-builder signs** the now-fused binary (the standard sign step picks it up automatically).
4. **`build/notarize.cjs`** runs as the `afterSign` hook — submits the signed-and-fused artifact to Apple.

`afterPack` runs **before** signing in electron-builder's lifecycle, so this order is the natural one — no manual ordering work needed beyond declaring both hooks.

### 5.2 Verification

- `npx @electron/fuses read --app /Applications/Mnemo.app` after every release. Output should match the table above.
- This is TVC-A4. The release-day checklist (§9) calls it out explicitly.

### 5.3 Linux Caveat

`EnableEmbeddedAsarIntegrityValidation` is a no-op on Linux at the Electron level (ASAR integrity isn't enforced on Linux). The fuse is still flipped — harmless if unused — and `OnlyLoadAppFromAsar` still works (refuses unpacked `app/`). v1 doesn't sign Linux anyway, so the missing ASAR-integrity check there is consistent with the unsigned-Linux stance.

---

## 6. CI Matrix

Per ADR-011. GitHub Actions, native runners only — no QEMU, no cross-OS emulation.

### 6.1 Triggers

- `push: tags: ['v*']` — the release pipeline.
- `workflow_dispatch` — manual-fire for re-runs (e.g. cert rotation requires a re-build, signing flake).
- A separate (already implicit in ADR-011) `ci.yml` workflow runs `npm ci && npm run typecheck && npm run test` on every push to `main` and every PR. Not a release pipeline; a "did we break the build" tripwire.

### 6.2 Matrix

| Runner | OS / arch | Targets | Sign | Notarize | Publish |
|---|---|---|---|---|---|
| `macos-14` | macOS 14, arm64 | Universal `.dmg` + `.zip` | yes | yes | yes |
| `windows-latest` | Windows Server 2022, x64 | NSIS `.exe` | no (v1) | n/a | yes |
| `ubuntu-24.04` | Ubuntu 24.04, x64 | `.AppImage` + `.deb` | n/a | n/a | yes |

**No `macos-13` x64 runner.** The `macos-14` arm64 runner produces a universal binary (`arch: [universal]`) that runs on both arm64 and x64 Macs. Building x64 separately would be redundant. Recommended: stay on the universal-from-arm64 path. Fall back to a separate `macos-13` x64 runner only if a future electron version regresses universal builds.

**No Linux arm64 runner.** GitHub's free `ubuntu-24.04-arm` runners are now GA, but Linux arm64 is **not** a v1 target (vision §"Target Platforms" lists only x64 Linux). Add when an arm64-Linux user surfaces and asks. Cheap to add.

**No `windows-11-arm` runner.** Windows arm64 audience is small; the unsigned x64 NSIS will run under emulation on Windows-on-arm. Add if real demand surfaces.

### 6.3 Per-Job Steps (high level)

The developer agent owns the YAML. Logical steps every runner does:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 20 LTS, npm cache enabled
3. `npm ci` (lockfile-only; never `npm install` in CI)
4. `npm run typecheck && npm run test`
5. `npm run build` (vite build → `dist/` and `dist-electron/`)
6. Per-OS: `npx electron-builder --mac|--win|--linux --publish always`
   - macOS: env includes `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `GH_TOKEN`
   - Windows: env includes `GH_TOKEN` only at v1; `AZURE_*` added at fast-follow
   - Linux: env includes `GH_TOKEN` only
7. electron-builder uploads artifacts to GitHub Releases as a **draft** (`releaseType: draft` on the GitHub provider, OR equivalently a workflow-level guard that publishes drafts and the maintainer flips to "Published" manually after smoke-testing).

### 6.4 Concurrency

- `concurrency: { group: 'release-${{ github.ref }}', cancel-in-progress: false }` — never cancel a running release; if a second tag pushes while the first is signing, it queues.

### 6.5 Caching

- `actions/cache` (or `setup-node`'s built-in cache) for `~/.npm` keyed on `package-lock.json`. ~30 sec saved per job on warm cache.
- Do **not** cache `node_modules/` directly — too big, and rebuild artifacts vary by arch (native modules).
- Do **not** cache `dist/` or `out/` — release artifacts must always be reproducible from source.

---

## 7. Release Flow — Step by Step

What happens on `git tag v1.0.0 && git push --tags`:

1. **Tag push** triggers `.github/workflows/release.yml`.
2. **Three jobs start in parallel** on `macos-14`, `windows-latest`, `ubuntu-24.04`. Each:
   - Installs Node + deps.
   - Runs typecheck + tests (any failure aborts the release for that runner).
   - Builds the renderer + main bundles (`vite build` → `dist/` + `dist-electron/`).
   - Invokes `electron-builder` for its OS:
     - **macOS:** packs → `afterPack` flips fuses → signs every binary in the bundle (via `CSC_LINK`/`CSC_KEY_PASSWORD`) → `afterSign` runs `@electron/notarize` (via `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`) → `xcrun stapler staple` on the `.dmg` and `.app` → uploads `.dmg` + `.zip` + `latest-mac.yml` + `*.blockmap` to a draft GitHub Release.
     - **Windows:** packs → `afterPack` flips fuses → unsigned NSIS → uploads `.exe` + `latest.yml` + `*.blockmap` to the same draft release.
     - **Linux:** packs → `afterPack` flips fuses → unsigned AppImage + `.deb` → uploads `.AppImage` + `.deb` + `latest-linux.yml` + `*.blockmap` to the same draft release.
3. **All three jobs finish.** GitHub Release is in **draft** state with all artifacts attached.
4. **Maintainer manually verifies** (see release-day checklist §9) — downloads each artifact, smoke-tests on a fresh Mac, fresh Windows VM, fresh Linux VM. Fuses verified via `npx @electron/fuses read`. Signature + notarization verified via `codesign -dv` and `spctl --assess`.
5. **Maintainer flips draft → published** in the GitHub UI. **This is the moment auto-update sees the new version.** Existing users on prior versions begin polling and detecting v1.0.0 within their next 6-hour window.

If step 4 reveals a problem, the draft can be **deleted** (via the GitHub UI) without ever exposing the broken release to users. The tag stays, but the artifacts aren't user-visible. Re-run the workflow via `workflow_dispatch` after pushing a fix to `main` and re-tagging (e.g. `v1.0.1`).

**Tag rollback.** If a published release proves broken: do **not** delete the GitHub Release — that breaks `latest.yml` URLs for users mid-download. Instead, immediately publish the next patch (`v1.0.1`) with the fix; users get bumped forward on their next 6-hour poll. The broken release stays in history as a record.

---

## 8. `@electron/rebuild` Policy

The repo's vite config externalizes `electron`, `chokidar`, and `fsevents` from the main bundle (per `CLAUDE.md`). They must remain runtime deps in `package.json`, not devDeps — already correct.

- **Native module policy:** prefer N-API prebuilt binaries over compile-from-source. `chokidar` itself is pure-JS; `fsevents` (its macOS backend, optional dep) ships prebuilt binaries via `node-gyp-build`. No rebuild typically needed.
- **CI policy:** electron-builder has a built-in `npm rebuild` step that runs `@electron/rebuild` automatically against the target Electron ABI. **Do not** add an explicit `npx electron-rebuild` step — that would double-rebuild and slow CI.
- **Per-arch verification:** after every CI build, the `out/**/*.node` files (if any) should match the matrix arch:
  - On `macos-14`: a universal build packs both arm64 and x64 fat-binary `.node` files; `lipo -archs` should report `arm64 x86_64`.
  - On `windows-latest`: `.node` files are x64 PE.
  - On `ubuntu-24.04`: `.node` files are x64 ELF.
- **Common shipping bug to avoid:** if a future native module is added and CI rebuilds against the host arch instead of the target arch, the wrong `.node` ships. The release-day checklist verifies `file out/**/*.node` (or the OS equivalent) matches the runner.
- **Package name nit:** `@electron/rebuild` is the correct package; the deprecated `electron-rebuild` package has the same `bin` name but is unmaintained. Today the repo doesn't depend on either explicitly (electron-builder pulls `@electron/rebuild` transitively). If a future change adds an explicit dep, it must be `@electron/rebuild`, not `electron-rebuild`.

---

## 9. Crash Reporting + Logging

Per ADR-014. **Local-only. No telemetry. No upload endpoint.**

### 9.1 Structured File Logging

- **Library:** `electron-log` ^5 (`devDependencies` is fine — wait, it runs at runtime: `dependencies`).
- **Configuration in `src/main/index.ts`:**
  - `log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')`
  - `log.transports.file.maxSize = 1 * 1024 * 1024` (1 MB; rotates to `main.old.log`)
  - `log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false`
- **Sweep:** replace `console.log` / `console.error` in `src/main/**` with `log.info` / `log.error`. One-time refactor; small diff.
- **What gets logged at what level:**
  - `error` — IPC handler exceptions (caught in `h(...)` wrapper; the wrapper already returns the error to the renderer, but should also `log.error` it for offline diagnosis), watcher fatal errors, autoUpdater errors, `mnemo-asset://` 403s.
  - `warn` — orphan state-file cleanup, watcher parse errors on user-edited cards with bad front-matter (the existing "silently swallow and wait for user to fix" path), config-load fallback to defaults.
  - `info` — app lifecycle (`whenReady`, `before-quit`), watcher start, index-rebuild duration, autoUpdater state transitions (`checking-for-update`, `update-available`, `update-downloaded`, `update-not-available`).
  - `debug` — IPC handler call traces (channel name + payload size, never payload contents — the vault is private), individual chokidar events. Dev-mode only.
- **Renderer console:** **not** captured to disk at v1. Renderer-side errors that matter cross the IPC seam as `ApiResult<{ ok: false, error }>` and the calling renderer code logs them to `console`. v1.x can wire `webContents.on('console-message', ...)` → main `log` if useful.
- **autoUpdater:** `autoUpdater.logger = log` so the rolling file captures every check / download / install attempt. This is the lifeline for diagnosing "stuck on v1.0.0" from the pre-mortem.

### 9.2 Crash Reporter

- **Configuration in `src/main/index.ts`:**
  ```
  crashReporter.start({ uploadToServer: false, submitURL: '' })
  ```
- **Effect.** Native crashes (renderer or main) write minidumps to `userData/Crashpad/`. **No remote upload.** The user can attach the dump to a GitHub issue manually if asked.
- **No Sentry, no Bugsnag, no telemetry beacons.** ADR-014 is explicit; the vision (§"What This Is NOT" — "No telemetry") is louder.

### 9.3 "Copy Diagnostics" Help-Menu Item

Per ADR-009 + ADR-014. Help menu → "Copy diagnostics". Copies to clipboard:
- App version (`app.getVersion()`)
- OS + version (`process.platform`, `os.release()`)
- Electron version (`process.versions.electron`)
- Last 50 lines of `userData/logs/main.log`
- **Not the vault path, never card contents.** Diagnostics is metadata only.

This is the support gold path: a user pastes the diagnostics into a GitHub issue, and the maintainer has the full context with no telemetry round-trip.

---

## 10. Verification Criteria This Plan Advances

From `.claude/system-design.md` §7. Each TVC below is observable by the maintainer or by tooling.

- **TVC-A1** — `codesign -dv --verbose=4 /Applications/Mnemo.app` reports the Apple Developer ID Application chain. Achieved by §2.1 + §3 + §7.
- **TVC-A2** — `spctl --assess --type execute --verbose=4 /Applications/Mnemo.app` reports `accepted source=Notarized Developer ID`. Achieved by §3.
- **TVC-A3** — `xcrun stapler validate Mnemo-X.Y.Z-universal.dmg` reports `validated`. Achieved by §3.
- **TVC-A4** — `npx @electron/fuses read /Applications/Mnemo.app/Contents/MacOS/Mnemo` matches the table in §5. Achieved by §5.
- **TVC-E1** — On a packaged build, `autoUpdater.checkForUpdates()` is called within 60 seconds of `whenReady`. Achieved by §4.1.
- **TVC-E2** — v0.0.1 → v0.0.2 round-trip succeeds on a real Mac. Achieved by §4.3 + the rehearsal protocol.
- **TVC-E3** — After the user clicks "Restart to update," next launch reports the new version. Achieved by §4.1.
- **TVC-E4** — `electron-updater` log shows `verifyUpdateCodeSignature` ran and matched. Achieved by §4.1.
- **TVC-F1** — Auto-updater silently retries on offline launch with no UI block. Achieved by §4.1 + §9.1 (logger captures `net::ERR_INTERNET_DISCONNECTED`).

The remaining TVCs (B for onboarding, C for live editor sync, D for window-state, G for vault portability, H for single-instance + IPC integrity) are owned by the developer agent's implementation work, not this packaging plan.

---

## 11. Release-Day Checklist

Before flipping a draft GitHub Release to "Published," verify all of:

- [ ] **macOS Developer ID + chain.** `codesign -dv --verbose=4 /Volumes/Mnemo/Mnemo.app` shows `Authority=Developer ID Application: <Org Name> (<TEAMID>)` → `Authority=Developer ID Certification Authority` → `Authority=Apple Root CA`.
- [ ] **macOS notarization stapled.** `xcrun stapler validate Mnemo-X.Y.Z-universal.dmg` returns `validated`. **And** `spctl --assess --type execute --verbose=4 /Volumes/Mnemo/Mnemo.app` returns `accepted source=Notarized Developer ID`.
- [ ] **Fuses applied.** `npx @electron/fuses read --app /Volumes/Mnemo/Mnemo.app` shows `RunAsNode 0`, `EnableNodeOptionsEnvironmentVariable 0`, `EnableNodeCliInspectArguments 0`, `EnableEmbeddedAsarIntegrityValidation 1`, `OnlyLoadAppFromAsar 1`, `EnableCookieEncryption 1`, `LoadBrowserProcessSpecificV8Snapshot 0`, `GrantFileProtocolExtraPrivileges 0`.
- [ ] **`latest-mac.yml` + `latest.yml` + `latest-linux.yml` all present** in the release artifacts. Each references binaries that are also attached.
- [ ] **`version` bumped.** `package.json` version matches the tag (no leading `v` in `package.json`; the tag has the `v`). `latest*.yml` files reference the same version. No prior release shares this version.
- [ ] **GitHub Release marked as a draft initially**, not pre-release, not published, until smoke-test is done.
- [ ] **Smoke test on a fresh Mac.** Download the `.dmg`, double-click, drag to Applications, launch. No Gatekeeper warning. Onboarding screen appears (clean userData) or `/review` (existing userData). VC-1 + VC-2 passing. Time from download click to review screen: ≤ 90 seconds.
- [ ] **Smoke test on Windows + Linux.** SmartScreen "More info" → "Run anyway" works on Windows. AppImage launches with `chmod +x && ./Mnemo*.AppImage`. `.deb` installs and launches via `dpkg -i`.

If any item fails: **delete the draft release**, fix the issue, push a new tag, re-run.

If the release is already published and a problem surfaces: **publish the next patch immediately**; never delete a published release (breaks `latest.yml` mid-download for users in flight).

---

## 12. Cost Summary

- **Apple Developer Program:** $99/year. Required.
- **Windows code signing:** $0 at v1 (deferred). Future: ~$120/year (Azure Trusted Signing) or ~$300+/year (DigiCert KeyLocker / SSL.com eSigner).
- **GitHub Actions:** $0 (free for public repos; Mnemo qualifies).
- **GitHub Releases:** $0 (free for public repos).
- **Update server:** $0 (GitHub Releases is the feed).
- **Crash + log infrastructure:** $0 (local-only).
- **v1 total:** **$99/year**, all to Apple. Everything else is free at this scale.

---

## 13. What's NOT Set Up Yet (and the trigger)

These are explicitly OUT of scope for v1; listed so future contributors don't treat them as gaps.

| Capability | Trigger to add |
|---|---|
| Windows code signing | ≥ 5 Windows users surface OR SmartScreen is the #1 GitHub-issue complaint for two consecutive weeks |
| Beta channel | First user volunteers to dogfood unstable releases |
| Staged rollout | DAU > a few hundred (a single bad release would burn meaningful trust) |
| Delta updates | Installer size > 200 MB (today is ~120 MB; not yet warranted) |
| Sentry / remote crash reporting | Issue triage becomes a real time sink (i.e., > 10 user-reported crashes/week) |
| Snap / Flatpak | Linux user explicitly asks for it; Flathub is the lower-friction add |
| Mac App Store distribution | Never — sandboxing breaks the file-watcher-based killer feature (VC-3) |
| Microsoft Store | Never (same reasoning, plus 30% revenue share for a free app) |
| Linux arm64 | Linux arm64 user surfaces |
| Windows arm64 | Windows-on-arm user surfaces with adoption data |

---

## 14. Disagreements with the Architect's ADRs (flagged for CEO)

I reviewed the architect's ADRs against current 2025 packaging realities and have **two minor flags** for CEO consideration. Neither is blocking; both are honest data points.

### Flag 1 (mild): The vision still names `update.electronjs.org`; ADR-006 picked `electron-updater`. ADR-006 is the correct call.

The product vision (§"Auto-Update Strategy") names `update.electronjs.org` as the chosen feed. The architect's ADR-006 over-rides this with `electron-updater` against GitHub Releases, citing Linux AppImage support as the reason. **I agree with ADR-006** — `update-electron-app` (the official `update.electronjs.org` client) does not support Linux, and supporting Linux auto-update is essentially free with `electron-updater` since electron-builder emits the manifests anyway. The vision text should be updated to reflect this so a future reader doesn't flip it back. Recommend a one-line vision-text patch by the CEO at the next sync.

### Flag 2 (mild): Auth — app-specific password vs Notary API key.

I'm recommending app-specific password for v1 (§3 above, "Auth" subsection) because Mnemo is a solo-maintainer project and the API-key path adds setup friction with no value at this scale. If the project ever grows to a team where multiple humans rotate signing keys, switch to Notary API key. Not blocking; just a calibration point.

### Not a disagreement, but worth flagging:

The architect's CI matrix (ADR-011) drops `macos-13` x64 in favor of universal-from-arm64. **I agree** — saves one runner per release, and electron-builder's universal output is well-trodden in 2025. Worth keeping a workflow_dispatch parameter that lets the maintainer re-introduce `macos-13` if a future Electron regression breaks universal builds (this is a 5-line addition; the developer agent can include it for free).

---

## 15. Handoff Guides

Files in `.claude/handoff/`:

- **`apple-developer-enrollment.md`** — for the maintainer. $99/year Apple Developer Program enrollment, certificate generation, app-specific password, env var prep. Blocks ADR-007. **First action.**
- **`github-secrets.md`** — for the maintainer. Every GitHub Actions secret, what to put in it, where to get the value, smoke-test workflow. Blocks ADR-011.
- **`release-rehearsal.md`** — the v0.0.1 → v0.0.2 round-trip protocol. Gates ADR-006 + tagging v1.0.0.
- **`windows-signing-fastfollow.md`** — POST-V1. Decision matrix for Azure Trusted Signing vs DigiCert KeyLocker vs SSL.com eSigner. Reference document for the future.

---

## 16. Open Questions

- **Should the draft GitHub Release auto-publish on green CI, or always require manual review?** Recommend manual at v1 (solo maintainer + first-ever signed release; the cost of one botched auto-publish is high, the cost of the manual click is 30 seconds). Revisit at v1.x once the pipeline has been through 5+ releases without surprise.
- **Should we sign the AppImage with `appimagetool`'s built-in GPG signing?** Possible (`zsync` updates can verify against a public key), but the AppImage audience is small and most don't import GPG keys for app verification. Defer; revisit if a Linux user asks.
- **Should the `.deb` ship a desktop-file integration that adds a "Review now" command to the user's launcher?** Nice-to-have for the daily-habit story; out of scope for v1 packaging. v2 surface.
