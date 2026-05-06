---
name: common-electron-app-devops-package
description: DevOps sets up the full Electron packaging + release pipeline — Forge 7.x (default) or electron-builder, code signing for macOS (Developer ID + @electron/notarize → notarytool + staple) and Windows (Azure Trusted Signing as the post-EV-hardware default), electron-updater ≥ 6.3.9 with `verifyUpdateCodeSignature` ON, the @electron/fuses table including ASAR integrity, cross-platform CI matrix on native runners (no QEMU), `@electron/rebuild` per-arch, and client handoff guides for everything the client must do (Apple Developer enrollment, Azure Trusted Signing tenant). Produces `.claude/packaging-plan.md` plus per-action handoff guides under `.claude/handoff/`. Use after system design is approved, before or during sprint.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent
argument-hint: "[--update to revise existing plan] [--handoff to generate client guides only]"
---

# Electron Package & Ship — Packaging, Signing, Auto-Update

You are the CEO. The system design is approved. Now the **devops** engineer sets up everything needed to produce signed, notarized, self-updating installers across mac / Windows / Linux.

## Step 1: Verify inputs

Check that these files exist:
- `.claude/system-design.md` — ADR-4 (builder), ADR-5 (auto-update), ADR-3 (fuses)
- `.claude/product-vision.md` — target platforms, distribution channels, auto-update strategy
- `.claude/tasks/_overview.md` — to understand what's being built
- `.claude/ceo-brain.md` — constraints, timeline, signing-cert availability

If `$ARGUMENTS` contains `--update`, read `.claude/packaging-plan.md` and revise.
If `$ARGUMENTS` contains `--handoff`, skip to Step 4 (generate client guides only).

## Step 2: Brief the DevOps engineer

Send **devops** with this brief:

> Read these files:
> - `.claude/system-design.md` — ADR-4 (builder choice), ADR-5 (auto-update strategy), ADR-3 (fuses table), security plan
> - `.claude/product-vision.md` — target platforms (mac/Win/Linux + arches + min OS versions), distribution channels (DMG/NSIS/AppImage default ON; MAS/MSIX/Snap/Flatpak optional)
> - `.claude/ceo-brain.md` — constraints, signing-cert availability (Apple Developer enrollment, Windows signing channel)
> - `.claude/tasks/_overview.md` — what features are being built
>
> Create a complete packaging plan. Save it as `.claude/packaging-plan.md`.
>
> The document MUST follow this structure:
>
> ````markdown
> # Packaging Plan
> > Version {N} — {date}
> > Based on system design v{N}
>
> ## 1. Builder
> **Choice:** {Electron Forge 7.x | electron-builder} — {one paragraph why for THIS project}
> Forge 7.x is the boring default — first-party, gets new Electron features day one. Pick electron-builder when you need staged rollouts, delta updates, or exotic targets (Snap/Flatpak/AppImage variants).
> **Don't mix the two.**
>
> ## 2. Targets & Architectures
>
> | Platform | Target | Arch | Min OS | Default ON? |
> |----------|--------|------|--------|------------|
> | macOS | DMG | arm64 + x64 (universal from arm64) | {12+} | YES |
> | macOS | MAS | x64 + arm64 | {12+} | only if vision says so |
> | Windows | NSIS | x64 + arm64 | {Win 10 21H2+} | YES |
> | Windows | MSI / MSIX | x64 | {Win 10+} | only if vision says so |
> | Linux | AppImage | x64 + arm64 | glibc {2.31+} | YES |
> | Linux | deb | x64 + arm64 | {Ubuntu 22.04+} | YES |
> | Linux | rpm / Snap / Flatpak | x64 | distro-specific | only if vision says so |
>
> macOS universal builds via `--arch=universal` from the arm64 runner.
>
> ## 3. CI Matrix (native runners — no QEMU)
>
> ```yaml
> # GitHub Actions
> jobs:
>   build:
>     strategy:
>       matrix:
>         include:
>           - { os: macos-14,         arch: arm64 }
>           - { os: macos-13,         arch: x64 }
>           - { os: windows-latest,   arch: x64 }
>           - { os: windows-11-arm,   arch: arm64 }   # GA 2025
>           - { os: ubuntu-24.04,     arch: x64 }
>           - { os: ubuntu-24.04-arm, arch: arm64 }   # free on GH
>     runs-on: ${{ matrix.os }}
>     steps:
>       - uses: actions/checkout@v4
>       - uses: actions/setup-node@v4
>         with: { node-version: 20, cache: npm }
>       - run: npm ci                    # never `npm install` in CI
>       - run: npx @electron/rebuild     # NOT electron-rebuild (deprecated)
>       - run: npm test
>       - run: npm run package -- --arch=${{ matrix.arch }}
>       - run: npm run make
>       - if: matrix.os == 'macos-14'
>         run: npm run notarize          # @electron/notarize → notarytool + staple
>       - run: npm run publish           # uploads to update server
> ```
>
> Why native runners: cross-compiling Electron across architectures via QEMU is unreliable for native modules. GH now offers free `windows-11-arm` and `ubuntu-24.04-arm` — use them.
>
> ## 4. macOS Signing & Notarization
>
> ### Identities
> - **Developer ID Application** cert (NOT Mac App Store cert unless shipping MAS).
> - Hardened runtime ON (required for notarization).
> - Entitlements plist:
>   ```xml
>   <key>com.apple.security.cs.allow-jit</key><true/>
>   <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
>   <!-- only the entitlements your app actually needs; default-deny -->
>   ```
> - All embedded helper apps signed with `--deep` discipline.
>
> ### Environment
> ```
> CSC_LINK=...              # base64-encoded .p12 or .keychain reference
> CSC_KEY_PASSWORD=...
> APPLE_ID=...              # OR
> APPLE_APP_SPECIFIC_PASSWORD=...
> APPLE_TEAM_ID=...
> # OR (preferred for CI):
> APPLE_API_KEY=...         # JWT
> APPLE_API_KEY_ID=...
> APPLE_API_ISSUER=...
> ```
>
> ### Notarization
> - `@electron/notarize` invokes `notarytool` (Apple's modern flow; the old `altool` is deprecated).
> - Always `xcrun stapler staple` after notarization succeeds — without staple, offline first-launch is rejected.
>
> ## 5. Windows Signing
>
> Post-June-2023 reality: code-signing CAs no longer issue exportable keys; EV certs require hardware tokens. Pick ONE, ranked:
>
> 1. **Azure Trusted Signing** (~$10/mo, instant SmartScreen reputation, US/CA orgs with 3yr+ history). electron-builder ≥ 25 supports `azureSignOptions` natively. **DEFAULT for new projects.**
> 2. **DigiCert KeyLocker** / **SSL.com eSigner** — cloud HSM via signtool plugin. Fallback when Azure Trusted Signing isn't available (e.g. EU org, or org < 3yr).
> 3. **YubiKey / eToken EV** — only with a human at a physical machine. NOT usable on hosted CI runners.
>
> Skip on-disk `.pfx` — current CAs won't issue exportable keys.
>
> ### Environment
> ```
> # Azure Trusted Signing (preferred)
> AZURE_TENANT_ID=...
> AZURE_CLIENT_ID=...
> AZURE_CLIENT_SECRET=...
> AZURE_TRUSTED_SIGNING_ACCOUNT=...
> AZURE_CERTIFICATE_PROFILE=...
> ```
>
> ## 6. Linux Packaging
>
> - AppImage: signed via embedded GPG signature; verified at update time.
> - deb: GPG-signed package; published to apt repo or direct-download.
> - Snap / Flatpak / rpm: only if vision asks.
>
> No code-signing CA story on Linux equivalent to mac/Win — trust comes from the package source.
>
> ## 7. @electron/fuses (set at package time, BEFORE signing)
>
> Production values:
>
> | Fuse | Value | Why |
> |------|-------|-----|
> | `RunAsNode` | `false` | Prevents the Electron binary from being executed as a generic Node runtime |
> | `EnableNodeOptionsEnvironmentVariable` | `false` | Blocks `NODE_OPTIONS` injection |
> | `EnableNodeCliInspectArguments` | `false` | Blocks `--inspect` debugger attach |
> | `EnableCookieEncryption` | `true` | Cookies encrypted at rest |
> | `EnableEmbeddedAsarIntegrityValidation` | `true` | Detects tampering with packaged code |
> | `OnlyLoadAppFromAsar` | `true` | Pairs with the above — refuse to load app code from anywhere else |
> | `LoadBrowserProcessSpecificV8Snapshot` | `true` | Cold-start improvement; pairs with snapshot tooling |
> | `GrantFileProtocolExtraPrivileges` | `false` | Locks down `file://` |
>
> **Verification step in CI:** `npx @electron/fuses read --app <packaged path>`. Fail the build if any value drifts.
>
> ASAR integrity REQUIRES sign-after-package order: package → fuses → sign → notarize → staple. Any other order breaks the integrity check.
>
> ## 8. Auto-Update
>
> ### Choice
> **{electron-updater ≥ 6.3.9 | update-electron-app + update.electronjs.org | none}** — {why}
>
> electron-updater 6.3.9 fixes CVE-2024-39698. Older versions: never. `verifyUpdateCodeSignature` MUST stay ON; without it, an attacker who controls the update channel can ship code signed by anyone.
>
> update.electronjs.org is free for OSS public GitHub repos and uses Squirrel under the hood — perfectly fine when you don't need channels or staged rollout.
>
> ### Channels (electron-updater)
> - `stable` and `beta` published as separate `latest.yml` (and `latest-mac.yml`, `latest-linux.yml`) under `releases/<channel>/`.
> - `publisherName` matches the cert CN — electron-updater verifies.
> - Staged rollout via the `stagingPercentage` field in `latest.yml`.
>
> ### Server
> - **{S3 + CloudFront | GitHub Releases | self-hosted bucket}** with HTTPS-only access.
> - `latest.yml` published atomically (write-then-rename) so clients never see a half-written manifest.
>
> ### Renderer surface
> - One IPC channel: `updater:check`, `updater:download`, `updater:apply`. Renderer is a thin UI; main owns the state machine.
>
> ## 9. Native Modules
>
> - Pure-JS first → N-API prebuilt second (`node-gyp-build` / `prebuild-install`) → compile-from-source last.
> - `@electron/rebuild` (NOT deprecated `electron-rebuild`) per-arch in CI.
> - Verify built artefacts: `file *.node` matches the matrix arch (catches stray x64 .node in arm64 build).
>
> ## 10. Release-Day Checklist (the reviewer also enforces)
>
> 1. All helper apps signed (`--deep` discipline on macOS).
> 2. Notarization passed AND stapled.
> 3. `latest.yml` (and `latest-mac.yml`, `latest-linux.yml`) published atomically.
> 4. `publisherName` matches cert CN.
> 5. `version` bumped in `package.json`; no two artefacts share a version.
> 6. ASAR integrity enabled + signed-after-packaging order respected.
> 7. Native modules rebuilt for the target arch (`file *.node` confirms).
> 8. Update-server URL + cert match.
> 9. `npx @electron/fuses read --app <path>` shows the production fuse table.
>
> ## 11. Client Handoff Actions
>
> | # | Action | Guide | Status |
> |---|--------|-------|--------|
> | 1 | Enroll in Apple Developer Program ($99/yr) | `.claude/handoff/01-apple-developer.md` | PENDING |
> | 2 | Generate Developer ID Application cert + App-specific password | `.claude/handoff/02-apple-cert.md` | PENDING |
> | 3 | Set up Azure Trusted Signing tenant + signing-account + certificate profile | `.claude/handoff/03-azure-trusted-signing.md` | PENDING |
> | 4 | Provide update-server bucket / domain | `.claude/handoff/04-update-server.md` | PENDING |
> | 5 | (Optional) Mac App Store enrollment | `.claude/handoff/05-mas-enrollment.md` | PENDING |
> | ... | ... | ... | ... |
>
> ## 12. Cost Estimate
>
> | Service | Monthly Cost | Notes |
> |---------|-------------|-------|
> | Apple Developer Program | $8.25 ($99/yr) | Required for mac signing + notarization |
> | Azure Trusted Signing | ~$10 | Per certificate profile |
> | Update server (S3 + CloudFront) | $5–50 | Scales with download volume |
> | CI minutes | $0–{N} | GH free tier covers most projects |
> | **Total** | **~${N}/month** | At MVP scale |
>
> ## 13. Not Yet Needed (and when to add)
>
> | Feature | Add When | Estimated Effort |
> |---------|----------|------------------|
> | Delta updates | Installer >100 MB AND frequent releases | 1 week (electron-builder switch) |
> | Staged rollout | First 1k+ paid users — risk of bad release | 1 day |
> | Mac App Store | Vision asks for it | 1–2 weeks (sandbox entitlements rework) |
> | Microsoft Store / MSIX | Enterprise customer asks | 1 week |
> | Snap / Flatpak | Linux distro request | 1–2 weeks |
> | Crash reporting at scale | Sustained crash-rate signal | 2–3 days (Sentry tier upgrade + symbol upload) |
> ````
>
> **Rules:**
> - Default to Forge 7.x. Justify electron-builder if picked.
> - Native runners only — never QEMU for cross-arch builds.
> - macOS: hardened runtime + notarization + staple. ALWAYS.
> - Windows: Azure Trusted Signing first; pinned alternatives second; on-disk `.pfx` never.
> - electron-updater MUST be ≥ 6.3.9; `verifyUpdateCodeSignature` MUST stay ON.
> - `@electron/rebuild`, NOT deprecated `electron-rebuild`.
> - Sign AFTER packaging, AFTER fuses set. Order matters for ASAR integrity.
> - `npm ci` in CI. Never `npm install`.
> - Include cost estimates — the client needs to budget signing.
> - List EVERYTHING the client must do manually, with handoff guides.

## Step 3: Create handoff guides

For every item in the "Client Handoff Actions" table, send **devops** to create a detailed step-by-step guide:

> For each handoff action in `.claude/packaging-plan.md`, create a guide in `.claude/handoff/`.
> Each guide must be so clear that a non-technical client can follow it in 30 minutes.
> Include URLs, what to click, what to type, what to share back with us, and how long the step typically takes.
> Mention that Apple Developer enrollment can take 24-48 hours and Azure Trusted Signing requires 3-year+ org history (a hard gate).

## Step 4: Implement packaging

Once the client completes their handoff actions (or in parallel for things that don't need client input), send **devops** to create the actual packaging files:

> Based on `.claude/packaging-plan.md`, create:
> - Builder config — `forge.config.ts` OR `electron-builder.json` (whichever ADR-4 chose)
> - macOS entitlements — `entitlements.plist` and `entitlements.inherit.plist` (if helper apps need them)
> - Notarization wiring — `@electron/notarize` invoked post-package on macOS
> - Windows signing wiring — `azureSignOptions` (or alternative) in builder config
> - Fuses configuration — `@electron/fuses` flipping the values from the plan, applied AFTER package and BEFORE sign
> - Auto-update wiring — electron-updater (or update-electron-app) initialization in main; channel + server URL configured
> - `.github/workflows/release.yml` — the matrix above; secrets referenced by env-var name (never inlined)
> - `npm scripts` — `package`, `make`, `notarize`, `publish` consistent with the chosen builder
> - `package.json` `productName`, `appId`, `publisherName` — must match the signing cert CN
>
> You CAN create config + workflow files. You MUST NOT modify application code — that's the developer's domain. If main needs auto-updater initialization, request it from the developer with the exact API surface you need.

## Step 5: Review and present

Read the packaging plan yourself. Check:
- Forge vs electron-builder justified for THIS project?
- CI matrix on native runners (no QEMU)?
- macOS: hardened runtime + notarization + staple?
- Windows: Azure Trusted Signing default OR justified alternative?
- Fuses table includes ASAR integrity + RunAsNode disabled?
- Sign-after-package order respected?
- electron-updater ≥ 6.3.9; `verifyUpdateCodeSignature` ON?
- Handoff guides cover every cert / account the client must provision?
- Cost estimate honest (Apple Developer $99/yr is mandatory; Azure Trusted Signing is real money)?

Present to the client:
> "Here's the packaging plan:
> - Builder: {choice}; signed installers for {platforms} via native runners
> - macOS: Developer ID + notarytool + staple
> - Windows: {Azure Trusted Signing | alternative}
> - Linux: AppImage + deb (signed)
> - Auto-update: electron-updater ≥ 6.3.9 with `verifyUpdateCodeSignature` ON
> - Cost: ~${N}/month (mostly Apple Developer + Azure Trusted Signing)
> - {N} things I need from you (handoff guides ready):
>   1. {action 1 — and how long it typically takes}
>   2. {action 2}
> - We can start building immediately — packaging will be ready in parallel."

## Step 6: Update CEO brain

Update `.claude/ceo-brain.md`:
- "Key Decisions Log" → packaging plan: {builder}, {Win signing path}, electron-updater {version}
- "Constraints" → add any signing-cert provisioning gates discovered (e.g. Azure Trusted Signing requires 3-year org history)
