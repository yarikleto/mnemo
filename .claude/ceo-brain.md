# CEO Knowledge Base — Mnemo
> Last updated: 2026-05-07

## Mission

**Anki, but your cards are markdown files you own.** A local-first spaced-repetition desktop app where every card is a plain `.md` file in a folder you control — editable in any external editor, version-controllable in git, shareable as a single `.mnemo.zip`. Scheduling uses FSRS.

## Current State

**Code-complete v1. Waits on Apple Developer credentials before the first signed release tag.**

The application is being daily-driven by its author (the user). All core features work: review with FSRS, browse, dashboard with 6 widgets, in-app authoring, archive export/import, full-text search, file watcher live-syncing changes from external editors, namespace tree, deck delete, dark/light/system themes. The codebase is well-structured with strict main/preload/renderer separation, contextIsolation + sandbox enabled, IPC handlers Zod-validated, custom CSP, sandboxed `mnemo-asset:` protocol for vault images.

Between 2026-05-06 and 2026-05-07 the M0 / M1 / M2 release surface landed in code:

- **First-run vault picker** (`/onboarding`) with backward-compat silent migration for existing users. Sidebar suppressed pre-onboarding; "Change vault…" available in Settings.
- **Native macOS application menu** (Mnemo / File / Edit / View / Window / Help) with `role:` items for stock accelerators and `menu:<verb>` push events for the app's custom commands. `Menu.setApplicationMenu(null)` on Win/Linux.
- **Window-state persistence** (`window-state.json`, separate from config.json) with multi-monitor clamp, debounced 500 ms saves, sync flush on `before-quit`.
- **`lastRoute` persistence** so quit-and-relaunch lands the user back where they were.
- **Single-instance lock** with `second-instance` focus handler.
- **Auto-update** via `electron-updater@^6.3.9` against GitHub Releases, gated by `app.isPackaged`. 30 s startup delay, 6 h poll, `verifyUpdateCodeSignature` ON. Renderer-side `<UpdateBanner>` and Settings → Updates toggle.
- **`electron-builder.yml`** with `publish: github`, hardened-runtime + entitlements, universal mac DMG, `afterSign` notarize hook, `afterPack` fuses hook (8 fuses per ADR-012).
- **CI** at `.github/workflows/release.yml` — 3-leg matrix on `macos-14` + `windows-latest` + `ubuntu-24.04`, publish-as-draft to GitHub Releases on every `v*` tag.
- **Logging + crash reporting** — `electron-log` rotating file at `userData/logs/main.log`; `crashReporter.start({ uploadToServer: false })`; `copyDiagnostics` IPC tails the last 50 log lines into the clipboard.
- **Playwright e2e specs** — onboarding (TVC-B1/B2), live-edit (TVC-C2), window-state + lastRoute (TVC-D1/D3), offline (TVC-F1).
- **Animation polish + F-013 external-edit conflict UX** — modal pop-ins, route fade-ins, OS-level `prefers-reduced-motion` honored, conflict banner in editor when an external write would clobber unsaved changes.
- **README installation section** per platform (Gatekeeper, SmartScreen, AppImage `chmod +x`).

Vitest 96/96 passing, typecheck clean, `npm run build` clean, packaged-bundle boot smoke verified on a fresh `userData`.

**What's still blocking the actual `v1.0.0` tag (all maintainer-side, no more code work):**

1. **Apple Developer enrollment** ($99/yr, ~2-day approval). Handoff guide: `.claude/handoff/apple-developer-enrollment.md`.
2. **Developer ID `.p12` export + app-specific password.** Handoff guide: `.claude/handoff/github-secrets.md` (covers both this and the next step).
3. **Six GitHub Actions secrets** pasted into the repo's Settings → Secrets and variables → Actions.
4. **The release-day rehearsal** — cut `v0.0.1`, then `v0.0.2`, observe the auto-update round-trip end-to-end on a fresh Mac. Procedure documented in `.claude/handoff/release-runbook.md` and `.claude/handoff/release-rehearsal.md`. Until this passes, no `v1.0.0` tag.

Until those four land, the CI workflow runs but `notarize.cjs` skips with a "secrets not set" log line and the .dmg ships ad-hoc-signed only.

## The Bet

**"What important truth do few people agree with us on?"** — That spaced-repetition's real bottleneck isn't the algorithm (Anki has solved that), it's authoring friction. The biggest reason power-learners abandon Anki is that authoring and bulk-editing are second-class citizens compared to plain-text-in-an-editor. If we make the cards diff-friendly, editor-friendly, git-friendly, grep-friendly — i.e. just files — we unlock a daily-driver experience that no SQLite-backed product can match. The technically-pedantic learner audience (devs, language learners, med students who already live in their editor) is small but loyal and underserved.

## Strategic Priorities

In execution order:

1. ~~**First-run vault picker**~~ — **DONE** 2026-05-07. `/onboarding` route, default vault path button, folder picker, silent backward-compat for existing users.
2. **Apple Developer enrollment + secrets** (CLIENT). The 2-day Apple-side wait is the long pole. Handoff: `apple-developer-enrollment.md` → `github-secrets.md`. **This is the ONLY thing standing between the current main and a real signed v1.0.0.**
3. ~~**electron-builder signing + notarization config**~~ — **DONE** 2026-05-07. `afterSign` notarize hook, `afterPack` fuses hook, hardened-runtime entitlements, universal mac DMG. Activates the moment TASK-003's secrets land.
4. ~~**Auto-update wiring**~~ — **DONE** 2026-05-07. `electron-updater@^6.3.9` against GitHub Releases (not `update.electronjs.org` — overridden by ADR-006 because `update-electron-app` doesn't support Linux AppImage). Renderer banner + Settings toggle wired.
5. ~~**CI matrix**~~ — **DONE** 2026-05-07. `.github/workflows/release.yml` covers `macos-14` + `windows-latest` + `ubuntu-24.04`, publish-as-draft on `v*` tag. `macos-13` x64 leg removed — SPIKE-003 confirmed `macos-14` produces a working universal DMG.
6. **Cut v0.0.1 → v0.0.2 round-trip rehearsal** (CLIENT, after #2). Required before `v1.0.0`. Runbook: `release-runbook.md` § "Round-trip rehearsal protocol".
7. **Cut v1.0.0.** Signed Mac DMG, unsigned AppImage/deb, unsigned Windows NSIS. README install section already lands the platform expectations.
8. **Tester pass on the packaged build.** Vitest 96/96 passing; Playwright e2e specs exist for onboarding / live-edit / window-state / offline against `dist-electron/main/index.js`. What's still missing is exploratory testing on a fresh Mac without dev tools after a real signed DMG exists.
9. **Windows signing fast-follow** — TASK-FF-1/FF-2. Azure Trusted Signing tenant once ≥ 5 Windows users surface. Handoff: `windows-signing-fastfollow.md`.
10. **v2 surface decisions**: tray + due-card notifications? Multi-vault? Anki importer? Defer until v1 has been in real use for ~30 days.

## Product Vision

See [.claude/product-vision.md](./product-vision.md). Approved 2026-05-06.

## Approved Prototype

None — Mnemo is an existing product with shipped UI, not a greenfield project. The "prototype" is the running app itself. Screenshots in `README.md` and the live `npm run dev` build serve the role.

If a future feature requires design exploration, the designer will produce wireframes + Tailwind prototypes in `.claude/prototypes/<feature>/` per the standard flow. None pending today.

## Target User & Platforms

**User:** the solo power-learner — technical, comfortable with markdown + git, already using or considering Anki, hits Anki's lock-in friction. Authors as much as they review. Lives in their editor of choice. The maintainer themselves is the v1 persona.

**Platforms (v1):**
- **macOS** (arm64 + x64, universal, min 12 Monterey): first-class. Signed + notarized.
- **Linux** (AppImage + deb): best-effort. Unsigned. Audience expected to be comfortable with `chmod +x`.
- **Windows** (NSIS .exe): best-effort. Unsigned at v1; Azure Trusted Signing as fast-follow.

**Distribution:** GitHub Releases only. No App Store, no Microsoft Store, no Snap, no Flatpak.

**Auto-update:** `electron-updater ≥ 6.3.9` against GitHub Releases. Non-negotiable for v1. (Initial draft of vision said `update.electronjs.org`; architect's ADR-006 overrode because `update-electron-app` doesn't support Linux AppImage.)

**Lifecycle:** foreground app for v1. Background-resident with tray + due-card notifications is v2 territory.

## MVP Scope

The embarrassingly small first version is **a signed, notarized, auto-updating macOS `.dmg`** with all current features and a first-run vault picker. Linux + Windows builds are produced unsigned and shipped alongside; users on those platforms see warnings, documented in the README.

Specifically deferred from MVP:
- Tray + notifications
- Multi-vault support
- Anki `.apkg` importer
- Windows code signing
- Plugin system
- Mobile companion
- Sync infrastructure

## Pre-Mortem: Why This Could Fail

1. **Code-signing never lands end-to-end.** Apple Developer enrollment + Windows signing tenant are bureaucratic chores; if they slip, every prospective user hits a Gatekeeper/SmartScreen warning and bails. *Mitigation:* the entire `electron-builder.yml` + `afterSign` + `afterPack` plumbing already sits in tree behind a "secrets present?" check, so the moment enrollment lands the next CI run produces a signed + notarized DMG with no further code work. The risk is now purely a calendar risk on Apple's side.
2. **Auto-update silently breaks on first ship.** Even with `electron-updater` wired, the v0.0.1 → v0.0.2 round-trip on a real signed Mac is the only way to know the publisher signature, blockmap diffing, and `quitAndInstall` actually work end-to-end. *Mitigation:* the rehearsal is documented in `release-runbook.md`; client must pass it before promoting a `v0.0.x-rc` to a real `v1.0.0`.
3. ~~**Onboarding cliff.**~~ — **MITIGATED** by the `/onboarding` route landed 2026-05-07. Backward-compat silent migration ensures existing-user upgrades don't regress.

## Constraints

- **Solo maintainer.** No team. Every hour spent on infrastructure is an hour not spent on product.
- **Apple Developer enrollment** ($99/yr USD) — required, not yet done.
- **Windows code signing** — Azure Trusted Signing or DigiCert KeyLocker. Pricey (~$100–$300/yr depending on provider) and requires business identity validation. Deferred.
- **Public GitHub repo** — `github.com/yarikleto/mnemo`, already public. Unlocks `update.electronjs.org` for free.
- **No telemetry.** Local-first ethos. Documented loudly.

## Key Decisions Log

- **2026-05-07** — M0/M1/M2 code surface landed in 5 commits on `main` (`c42515c` → `5d51a9b`): motion polish + F-013, custom number stepper, onboarding + native menu + fullscreen revert, signed/notarized macOS pipeline, auto-update, window-state, logging, CI. Code-only — credentials still pending.
- **2026-05-07** — Decided (architect ADR-006 ratified, knowledge base now matches): `electron-updater@^6.3.9` against GitHub Releases, NOT `update.electronjs.org`. Latter doesn't support Linux AppImage; ours does (per SPIKE-001 findings).
- **2026-05-07** — Decided (per SPIKE-003): single `macos-14` arm64 runner produces the universal DMG. No separate `macos-13` x64 leg. Saves ~5 min CI time per release.
- **2026-05-07** — Decided (per SPIKE-002): unsigned-to-unsigned auto-update on Windows works (publisher comparison is null-vs-null, effectively no-op). Unsigned → signed transition (post-M3) requires a one-time manual download — never disable `verifyUpdateCodeSignature`.
- **2026-05-06** — Project kickoff (CEO `init` skill, existing-project mode). Vision approved by user. Next: architect produces system design ADRs around code-signing pipeline, auto-update wiring, first-run vault picker, CI matrix.
- **2026-05-06** — Decided: foreground app for v1; tray+notifications deferred to v2.
- **2026-05-06** — Decided: GitHub Releases only for distribution; no stores.
- **2026-05-06** — Decided: macOS first-class signed+notarized; Linux+Windows best-effort unsigned at v1; Windows signing as fast-follow.
- **2026-04-30** — (User) Completed CSP hardening + markdown URL sanitization (last security PR before kickoff).
- **2026-04-23 → 2026-04-30** — (User) Five-PR security hardening sweep: archive path-traversal, IPC namespace validation, ULID format constraint, CSP + URL sanitization.

## Open Questions

- **Tray + notifications — v2 yes, or never?** Decide after v1 has been in real use for 30 days.
- **Anki `.apkg` importer — build, or external tool?** Watch GitHub issues post-launch.
- **Multi-vault support — v2 or v3?** Real ask, not yet validated. Defer.
- **Windows EV cert provider — Azure Trusted Signing, DigiCert KeyLocker, or SSL.com eSigner?** DevOps researches and recommends when Windows audience justifies the spend.

## Pointers

- Engineering CLAUDE.md (project conventions, commands, architecture): [../CLAUDE.md](../CLAUDE.md)
- Product vision (this kickoff): [./product-vision.md](./product-vision.md)
- Repo: `github.com/yarikleto/mnemo` (public)
- App ID: `com.mnemo.app`
- Default vault: `~/Documents/mnemo`
- Config dirs: `~/Library/Application Support/Mnemo/` (mac), `%APPDATA%/Mnemo/` (win), `~/.config/Mnemo/` (linux)
