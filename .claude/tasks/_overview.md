# Mnemo v1 — Task Plan Overview

> Generated 2026-05-06 by the architect agent.
> Source of truth: `.claude/system-design.md` (ADR-006 … ADR-014, plus `fullscreen: true` revert).
> Product anchor: `.claude/product-vision.md` (VC-1 … VC-8).
>
> **Scope.** This is the v1 ship gap, not a greenfield decomposition. The five "documenting existing decision" ADRs (001–005) generate zero tasks — the architecture they describe is already shipping. Tasks below cover only:
> - The 9 "new design" ADRs (006–014).
> - The `fullscreen: true` revert called out in ADR-010.
> - The end-to-end signed/notarized/auto-updating macOS round-trip rehearsal.
>
> **Walking skeleton (Mnemo definition).** The existing app + signed + notarized + auto-updating end-to-end on macOS, validated by a v0.0.1 → v0.0.2 round-trip on a packaged build. That is Milestone 0. Anything past that is Milestones 1–3.

---

## Milestones at a glance

| Milestone | Goal | Status gate | State (2026-05-07) |
|---|---|---|---|
| **M0** Walking skeleton: signed, notarized, self-updating macOS build | A real downloadable signed `.dmg` from GitHub Releases that auto-updates v0.0.1 → v0.0.2 end-to-end on a fresh Mac. | TVC-A1, A2, A3, A4, E1, E2, E3, E4 all pass. | **Code complete.** Blocked on TASK-001/002/003 client credentials and TASK-017/018 release rehearsal. |
| **M1** First-run UX + single-window polish | New users land cleanly, the macOS menu feels native, the window remembers where it was, only one instance runs, basic logs exist. | TVC-B1–B4, D1–D3, H1–H2 pass; `fullscreen: true` removed; menu commands work. | **Done.** Onboarding + native menu + window-state + lastRoute + single-instance lock + electron-log + crashReporter all in tree on `main`. |
| **M2** Linux + Windows unsigned builds | Tag push produces working unsigned AppImage / .deb / NSIS artifacts; README documents the SmartScreen / AppImage prompts. | Manual install + smoke test on each platform; auto-update smoke on AppImage. | **Done in code.** Workflow legs land on tag push; manual install smoke gates on the v0.0.x rehearsal. |
| **M3** (post-v1, fast-follow) Windows code-signing | Once Azure Trusted Signing tenant lands, NSIS is signed, SmartScreen quiet. | A signed Windows artifact passes a fresh-machine launch with no SmartScreen warning. | **Deferred** until ≥ 5 Windows users surface (per vision). |

Total milestones: **4** (M0–M3).
Total tasks: **35** (TASK-001 … TASK-035) + **3 spikes** (SPIKE-001 … SPIKE-003).

**Done in code:** TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-013, TASK-014, TASK-015, TASK-016, TASK-019, TASK-020, TASK-021, TASK-022, TASK-023, TASK-024, TASK-025, TASK-026, TASK-028, TASK-029, TASK-030, TASK-031, TASK-032, TASK-033, TASK-034, TASK-035, TASK-036, plus all three spikes (SPIKE-001, SPIKE-002, SPIKE-003).

**Pending (client / calendar):** TASK-001 (Apple enrollment) → TASK-002 (`.p12` export) → TASK-003 (GitHub secrets) → TASK-017 (cut v0.0.1) → TASK-018 (cut v0.0.2 + round-trip rehearsal) → v1.0.0.

**Deferred:** TASK-FF-1, TASK-FF-2 (post-v1).

---

## Critical path

The longest dependency chain that gates M0 release. Any task on this chain that slips slips v1.

```
TASK-001 (Apple Developer enrollment — CLIENT BLOCKER, ~2 days)
  └─▶ TASK-002 (export Developer ID .p12 + create app-specific password)
       └─▶ TASK-003 (configure GitHub Actions secrets)
            └─▶ TASK-008 (electron-builder mac signing config + entitlements)
                 └─▶ TASK-009 (afterSign hook + @electron/notarize + staple)
                      └─▶ TASK-013 (afterPack @electron/fuses hook)
                           └─▶ TASK-014 (electron-updater wiring in main + UX in renderer)
                                └─▶ TASK-016 (GitHub Actions release workflow — macos-14 leg)
                                     └─▶ TASK-017 (cut v0.0.1 signed+notarized release)
                                          └─▶ TASK-018 (cut v0.0.2 + run round-trip rehearsal — TVC-E2/E3)
                                               └─▶ M0 GATE
```

**Estimated critical path duration:** ~6–8 working days end-to-end, of which ~2 days are pure waiting on Apple Developer enrollment (parallelizable — see below).

---

## Top 3 parallelization opportunities

1. **While Apple enrollment is pending (TASK-001 → TASK-002), everything not on the cert-path runs in parallel.** That covers the entire Milestone 1 surface: onboarding (TASK-019 … TASK-022), single-instance lock (TASK-026), window-state persistence (TASK-023 … TASK-025), `fullscreen: true` revert (TASK-027), native macOS menu (TASK-028 … TASK-030), basic logging (TASK-031 … TASK-032). About 60 % of the v1 work happens during the enrollment wait.
2. **The Linux and Windows unsigned-build legs of the CI matrix (TASK-033, TASK-034) are independent of the macOS signing leg.** They land as soon as the workflow skeleton (TASK-016) exists, gated only by SPIKE-001 (electron-updater on AppImage) and SPIKE-002 (NSIS unsigned auto-update behaviour).
3. **The renderer-side work for ADR-006 (auto-update banner UX) and ADR-008 (onboarding screen) are independent of the build pipeline.** TASK-015 (updater banner UI) and TASK-022 (onboarding screen UI) can ship behind feature checks before the signed pipeline exists; the developer agent can stub the IPCs.

---

## TVC + VC coverage

Every TVC in `system-design.md` §7 and every VC in `product-vision.md` §"Verification Criteria" must be advanced by ≥ 1 task. Below is the full mapping. Where a TVC traces to multiple VCs, all VCs are listed.

| TVC | VC trace | Verified by task(s) |
|---|---|---|
| TVC-A1 (codesign chain) | VC-1 | TASK-008, TASK-009, TASK-017 |
| TVC-A2 (spctl assess accepted) | VC-1 | TASK-009, TASK-017 |
| TVC-A3 (stapler validate) | VC-1 | TASK-009, TASK-017 |
| TVC-A4 (fuses match table) | VC-1 + def-in-depth | TASK-013, TASK-017 |
| TVC-B1 (no-config → /onboarding) | VC-2 | TASK-019, TASK-020, TASK-021, TASK-022 |
| TVC-B2 (default vault path round-trip) | VC-2 | TASK-020, TASK-021, TASK-022 |
| TVC-B3 (folder picker round-trip) | VC-2 | TASK-019, TASK-022 |
| TVC-B4 (onboardedAt timestamp) | VC-2 | TASK-020, TASK-021 |
| TVC-C1 (chokidar watcher tests) | VC-3 | (existing, no new task — covered by Vitest already shipping) |
| TVC-C2 (live external edit e2e) | VC-3 | TASK-035 (Playwright e2e for live-edit) |
| TVC-C3 (vault is plain text) | VC-7 | (existing invariant; informational — no new task) |
| TVC-D1 (window restore size) | VC-4 | TASK-023, TASK-024, TASK-025 |
| TVC-D2 (multi-monitor disconnect) | VC-4 | TASK-024, TASK-025 |
| TVC-D3 (lastRoute persistence) | VC-4 | TASK-025 |
| TVC-E1 (checkForUpdates within 60s) | VC-5 | TASK-014 |
| TVC-E2 (round-trip download) | VC-5 | TASK-018 |
| TVC-E3 (post-install version bump) | VC-5 | TASK-018 |
| TVC-E4 (signature verification log) | VC-1 + VC-5 | TASK-014, TASK-018 |
| TVC-F1 (offline launch + review) | VC-6 | TASK-035 (offline e2e leg) |
| TVC-G1 (git diff vault) | VC-7 | (existing invariant — informational, no new task) |
| TVC-G2 (archive round-trip) | VC-8 | (existing Vitest suites — informational, no new task) |
| TVC-H1 (single-instance focuses first) | def-in-depth, supports VC-3, VC-7 | TASK-026 |
| TVC-H2 (all IPCs through h(...)) | def-in-depth | (existing static check; lint added in TASK-031 if needed) |

| VC | Advanced by task(s) |
|---|---|
| VC-1 (clean Gatekeeper install) | TASK-001 → TASK-009, TASK-013, TASK-017 |
| VC-2 (first-run picker) | TASK-019 → TASK-022 |
| VC-3 (live external-editor sync) | TASK-035 (regression e2e) |
| VC-4 (preserves vault + route + display) | TASK-023, TASK-024, TASK-025 |
| VC-5 (auto-update within 24 h) | TASK-014, TASK-015, TASK-018 |
| VC-6 (offline launch) | TASK-035 (offline e2e leg) |
| VC-7 (vault is plain folder) | (architectural invariant — verified by TVC-C1, TVC-C3, TVC-G1; no new task needed) |
| VC-8 (export/import round-trip) | (existing test coverage; informational) |

**Coverage gaps:** None. Every TVC and VC is advanced by either a new task in this plan or an existing test/invariant in the shipped codebase.

---

## Blockers requiring client action

The following tasks are `BLOCKED` until the user (the maintainer) completes a one-time action that the agent cannot do. DevOps will produce handoff guides under `.claude/handoff/` (those guides are products of TASK-001, TASK-003, and the M3 fast-follow).

| Task | Client action required | Hard block? |
|---|---|---|
| **TASK-001** | Enroll in the Apple Developer Program ($99/yr). 2-day approval. | YES — blocks the entire macOS signing leg of M0. |
| **TASK-002** | Export Developer ID Application certificate as `.p12` from Keychain; generate an app-specific password at appleid.apple.com. | YES — depends on TASK-001. |
| **TASK-003** | Add 6 GitHub Actions repository secrets (`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, plus confirm `GITHUB_TOKEN` is sufficient). | YES — depends on TASK-002. |
| **TASK-035 (rehearsal leg)** | Provide a fresh Mac (or a wipeable VM / clean account) for the v0.0.1 → v0.0.2 round-trip. | Soft — without it the rehearsal runs on the maintainer's primary Mac with a `~/Library/Application Support/Mnemo/` snapshot reset. |
| **M3-fastfollow (TASK-FF-1)** | Provision an Azure Trusted Signing tenant (or DigiCert KeyLocker), validate business identity. Cost ~$10/mo + $50/yr. Defer until ≥ 5 Windows users surface. | YES for M3 only — does not block v1. |

---

## Spikes (time-boxed research)

Three open implementation questions that justify a 1-day timebox each before committing to the consuming task.

- **SPIKE-001** — Does `electron-updater@^6.3.9` reliably update an AppImage in place on Ubuntu 22.04 and 24.04 GNOME / KDE? (ADR-006 promises Linux auto-update; verify before TASK-014 finalizes the Linux UX surface.)
- **SPIKE-002** — Does an unsigned Windows NSIS build refuse to auto-update due to signature verification? (Resolves whether v1 Windows users get auto-update or a manual download flow until M3.)
- **SPIKE-003** — Confirm `macos-14` arm64 runner can produce a universal DMG that runs natively on Intel without a separate `macos-13` x64 runner. (ADR-011 assumes yes; verify before TASK-016 commits to a single-runner Mac matrix.)

---

## Task list (by milestone)

### M0 — Walking skeleton
- TASK-001 — Apple Developer enrollment handoff (CLIENT BLOCKER)
- TASK-002 — Developer ID `.p12` export + app-specific password handoff (CLIENT BLOCKER, depends on TASK-001)
- TASK-003 — GitHub Actions secrets handoff (CLIENT BLOCKER, depends on TASK-002)
- TASK-004 — Add `electron-updater` to runtime dependencies + `@electron/fuses` and `@electron/notarize` to devDependencies
- TASK-005 — Add `publish: { provider: 'github', owner, repo }` block to `electron-builder.yml`
- TASK-006 — Set `hardenedRuntime: true` in mac block + author `build/entitlements.mac.plist`
- TASK-007 — Switch mac targets to universal (arm64+x64) DMG + ZIP
- TASK-008 — Wire `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` into electron-builder mac signing (depends on TASK-003, TASK-006)
- TASK-009 — `afterSign` hook calling `@electron/notarize` with `notarytool` + auto-staple (depends on TASK-008)
- TASK-013 — `afterPack` hook flipping the 8 fuses from ADR-012 (depends on TASK-004)
- TASK-014 — `src/main/updater.ts` module: poll, download, push `update:ready`, gated by `app.isPackaged` (depends on TASK-004)
- TASK-015 — Renderer banner / toast for "update ready — restart to apply" + settings toggle for `autoUpdate.enabled` (depends on TASK-014's IPC contract)
- TASK-016 — `.github/workflows/release.yml` skeleton with `macos-14` leg (depends on TASK-003, TASK-005, TASK-008, TASK-009, TASK-013)
- TASK-017 — Cut `v0.0.1` tag, run release pipeline, install signed DMG on a fresh Mac, verify TVC-A1/A2/A3/A4 (depends on TASK-016)
- TASK-018 — Cut `v0.0.2` tag, observe v0.0.1 → v0.0.2 round-trip on the fresh Mac, verify TVC-E2/E3/E4 (depends on TASK-017)

### M1 — First-run UX + single-window polish
- TASK-019 — Add `pickVaultFolder` IPC channel (main → `dialog.showOpenDialog`) + zod schema + `Api` surface
- TASK-020 — Add `completeOnboarding` IPC channel + add `onboardedAt: string | null` to `ConfigSchema` + `loadConfig` no longer auto-creates default subdirs
- TASK-021 — Backward-compat path in `useAppStore.init`: existing user with valid `rootPath` and `cards/` present is auto-onboarded (writes timestamp without showing route)
- TASK-022 — Onboarding route at `/onboarding` (single screen, two buttons, gates `/review` until complete)
- TASK-023 — Revert `fullscreen: true` to `fullscreen: false` in `BrowserWindow` defaults
- TASK-024 — `src/main/window-state.ts` module: read/write `userData/window-state.json`, multi-monitor `workArea` clamping, debounced save, final synchronous flush on `before-quit`
- TASK-025 — Add `lastRoute: string | null` to `ConfigSchema`; renderer persists on navigation; `useAppStore.init` replays it on boot
- TASK-026 — Single-instance lock at the very top of `src/main/index.ts` + `second-instance` handler that focuses the existing window
- TASK-028 — `src/main/menu.ts`: macOS-only standard Cocoa menu via `Menu.buildFromTemplate` + `Menu.setApplicationMenu(null)` on Win/Linux
- TASK-029 — Custom menu items dispatch `menu:<verb>` events via `webContents.send`
- TASK-030 — Renderer `onMenuCommand(cb)` subscriber wired into `App` to handle `menu:new-card`, `menu:open-settings`, `menu:find`, `menu:import`, `menu:export`, `menu:nav-review|browse|dashboard|settings`, `menu:toggle-theme`
- TASK-031 — Add `electron-log@^5` to dependencies; replace `console.*` in `src/main/**` with `log.*`; rotating file at `userData/logs/main.log`
- TASK-032 — `crashReporter.start({ uploadToServer: false })` in main + "Copy diagnostics" Help menu item that copies app version + OS + tail of `main.log` to clipboard

### M2 — Linux + Windows unsigned builds
- TASK-033 — `windows-latest` job in release workflow producing unsigned NSIS `.exe`
- TASK-034 — `ubuntu-24.04` job in release workflow producing AppImage + `.deb` (depends on SPIKE-001 outcome)
- TASK-035 — Playwright e2e suite covering: live external-editor sync (TVC-C2), offline launch (TVC-F1), onboarding (TVC-B1/B2/B3), window-state restore (TVC-D1/D3)
- TASK-036 — README install section: macOS Gatekeeper expectation, Windows SmartScreen click-through, AppImage `chmod +x` + trust prompt, `.deb` install hint

### M3 — Windows signing fast-follow (post-v1)
- TASK-FF-1 — Azure Trusted Signing tenant handoff (CLIENT BLOCKER) + electron-builder `azureSignOptions` config
- TASK-FF-2 — Wire `azureSignOptions` secrets into `windows-latest` release job

> Numbering note: the developer agent reads tasks in this order. Numbers are sparse (no TASK-010/011/012/027) by design — those slots were reserved during planning for tasks that collapsed into siblings.

---

## How tasks are scoped

Per the architect's planning rules: every task below is **S** (≤ 1 working day, ≤ 5 files touched). No M, no L. If a task's "Plan" section grows beyond ~5 bullets, split it.

Every non-setup task declares a `**Verifies:**` line citing its TVC IDs (with VC trace).
