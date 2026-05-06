# CEO Knowledge Base — Mnemo
> Last updated: 2026-05-06

## Mission

**Anki, but your cards are markdown files you own.** A local-first spaced-repetition desktop app where every card is a plain `.md` file in a folder you control — editable in any external editor, version-controllable in git, shareable as a single `.mnemo.zip`. Scheduling uses FSRS.

## Current State

**Feature-complete MVP, security-hardened, not yet shipped.**

The application is being daily-driven by its author (the user). All core features work: review with FSRS, browse, dashboard with 6 widgets, in-app authoring, archive export/import, full-text search, file watcher live-syncing changes from external editors, namespace tree, deck delete, dark/light/system themes. The codebase is well-structured with strict main/preload/renderer separation, contextIsolation + sandbox enabled, IPC handlers Zod-validated, custom CSP, sandboxed `mnemo-asset:` protocol for vault images.

The most recent five PRs (Apr 23–30) are all security hardening (CSP, URL sanitization, ULID validation, IPC namespace validation, archive path-traversal). The author has stopped adding features and is battening down hatches — a clear "ready to ship" signal.

**What's blocking real shipping:**
1. No code signing (Apple Developer enrollment not yet done; Windows signing tenant not yet provisioned).
2. No notarization step in `electron-builder.yml` (no `afterSign` hook, no `@electron/notarize`).
3. No auto-update wiring (no `electron-updater` dep, no feed config).
4. No CI (no `.github/workflows/`); all packaging is manual via `npm run dist:*` on the dev's machine.
5. No first-run vault picker — first launch dumps the user into an empty `/review` against `~/Documents/mnemo`.

## The Bet

**"What important truth do few people agree with us on?"** — That spaced-repetition's real bottleneck isn't the algorithm (Anki has solved that), it's authoring friction. The biggest reason power-learners abandon Anki is that authoring and bulk-editing are second-class citizens compared to plain-text-in-an-editor. If we make the cards diff-friendly, editor-friendly, git-friendly, grep-friendly — i.e. just files — we unlock a daily-driver experience that no SQLite-backed product can match. The technically-pedantic learner audience (devs, language learners, med students who already live in their editor) is small but loyal and underserved.

## Strategic Priorities

In execution order:

1. **First-run vault picker** (product surface gap, blocks MVP). Onboarding screen at first launch lets the user choose a vault; without it, every demo to a friend is broken. Small effort, large UX win.
2. **macOS code signing + notarization end-to-end** (DevOps). Apple Developer enrollment → Developer ID cert → `electron-builder.yml` `afterSign` hook → `@electron/notarize` → `notarytool` → staple. The very first DevOps action.
3. **Auto-update via `update.electronjs.org`** (DevOps + Architect). Free for public GitHub repos. Wire it. Rehearse a v0.0.1 → v0.0.2 round-trip on a packaged build before declaring it working.
4. **CI matrix** (DevOps). GitHub Actions on `macos-14` (arm64) + `macos-13` (x64) + `windows-latest` + `ubuntu-24.04`. Build artifacts on tag. Sign + notarize on macOS. Publish to GitHub Releases.
5. **Cut v1.0.0**. Signed Mac DMG, unsigned AppImage/deb, unsigned Windows NSIS. README updated with install instructions and the SmartScreen-warning explainer.
6. **Tester pass on the packaged build** (Tester + Manual-QA). Vitest already covers unit + integration well (88/88 passing). What's missing is `electron-playwright-helpers` against the actual signed `.dmg`, and an exploratory pass on a fresh Mac without dev tools.
7. **Windows signing fast-follow** (DevOps). Azure Trusted Signing tenant once a few Windows users surface.
8. **v2 surface decisions**: tray + due-card notifications? Multi-vault? Anki importer? Defer until v1 has been in real use for ~30 days.

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

1. **Code-signing never lands end-to-end.** Apple Developer enrollment + Windows signing tenant are bureaucratic chores; if they slip, every prospective user hits a Gatekeeper/SmartScreen warning and bails. *Mitigation:* DevOps owns this as priority #2 above; Apple enrollment is the very first action.
2. **Auto-update silently breaks.** First end-to-end auto-update needs a real release-day rehearsal; if v1.0.0 → v1.0.1 doesn't round-trip, users stay stuck on v1.0.0 forever. *Mitigation:* the walking skeleton requires a v0.0.x → v0.0.x+1 round-trip on a packaged build before any v1.0.0 work.
3. **Onboarding cliff.** First launch with no vault picker = empty review screen = bounce. *Mitigation:* first-run vault picker is on the MVP critical path.

## Constraints

- **Solo maintainer.** No team. Every hour spent on infrastructure is an hour not spent on product.
- **Apple Developer enrollment** ($99/yr USD) — required, not yet done.
- **Windows code signing** — Azure Trusted Signing or DigiCert KeyLocker. Pricey (~$100–$300/yr depending on provider) and requires business identity validation. Deferred.
- **Public GitHub repo** — `github.com/yarikleto/mnemo`, already public. Unlocks `update.electronjs.org` for free.
- **No telemetry.** Local-first ethos. Documented loudly.

## Key Decisions Log

- **2026-05-06** — Project kickoff (CEO `init` skill, existing-project mode). Vision approved by user. Next: architect produces system design ADRs around code-signing pipeline, auto-update wiring, first-run vault picker, CI matrix.
- **2026-05-06** — Decided: foreground app for v1; tray+notifications deferred to v2.
- **2026-05-06** — Decided: GitHub Releases only for distribution; no stores.
- **2026-05-06** — Decided: `update.electronjs.org` for auto-update (free, official, public-repo path).
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
