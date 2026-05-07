# Product Vision — Mnemo
> Draft v1 — 2026-05-06

## Press Release (Working Backwards)

**Mnemo: An Anki for people who want to own their cards.**

For self-learners who want spaced-repetition without lock-in, Mnemo is a desktop app where every card is a plain markdown file in a folder you own. Edit cards in any editor, version-control the whole vault in git, share decks as a single `.mnemo.zip` — your study material never leaves your machine, never lives in someone else's database, never gets stuck inside an `.apkg`. Scheduling uses FSRS, the modern successor to Anki's SM-2. Unlike Anki, your cards are diff-friendly, editor-friendly, grep-friendly, git-friendly. They're just files.

## The Problem

Anki is the gold standard for spaced repetition, and its cards are trapped in a SQLite database wrapped in a binary `.apkg` blob. You can't `git diff` a card. You can't open a deck in VS Code. You can't fix a typo in vim and have the change reflected in your review queue. Power users who already live in their editor of choice — devs studying algorithms, language learners with a vault of vocab, medical students with thousands of fact cards — pay a tax every time they want to author or refactor.

The pain is small per card and large in aggregate: every time you want to bulk-edit, share, version-control, or just *look at* what you've written, the lock-in shows.

## Why a Desktop App

This is desktop-only by design — a website would defeat the entire premise.

- **Filesystem ownership.** The vault is a folder on your disk, populated with `.md` files. The user can `cd` into it. A web app cannot grant that.
- **Live external-editor sync.** chokidar watches the vault; when you save in vim/VS Code/Obsidian, the app's index updates within ~100ms. This is the killer feature, and it requires Node-side `fs.watch`.
- **Offline-first.** The app launches and runs the full review flow with no network. There is no server.
- **Privacy.** Your study material never crosses a network. No telemetry, no sync server, no account. Local-first by construction.
- **Git-friendly.** Because the vault is plain files, the user can `git init` it and version-control their own learning. The app never knows or cares.
- **OS integration potential** (post-MVP): file association for `.mnemo.zip` (double-click to import), drag-drop a card file from Finder, native notifications when due cards stack up, global "review now" hotkey.

## Target User

**The solo power-learner.** Specifically:

- Technical or technical-adjacent — comfortable with a folder of markdown files, knows what `git init` does.
- Already using Anki or considering it, but hits the lock-in friction (typos, bulk edits, sharing, version control).
- On macOS by default; many also run Linux. Some on Windows.
- Authoring matters as much as reviewing — they don't just consume decks, they write their own.
- Lives in their editor (VS Code / Obsidian / vim) and wants their study material to live there too.

The primary persona for v1 is **the maintainer themselves** — Mnemo is being daily-driven by its author. Validation comes from "do I actually use this every day" before "do strangers install it."

## Target Platforms

- **macOS** — Apple Silicon (`arm64`) + Intel (`x64`), universal build. Min macOS 12 (Monterey). **Unsigned** for v1; first-launch right-click → Open clears Gatekeeper.
- **Linux** — AppImage + `.deb` produced on every release, unsigned. The expected user is comfortable with `chmod +x` and AppImage trust prompts.
- **Windows** — NSIS `.exe` produced on every release, unsigned. SmartScreen "More info → Run anyway" on first install.

**v1 distribution posture (decided 2026-05-07): symmetric unsigned across all three platforms.** $99/yr Apple Developer enrollment + ~$100/yr Windows EV signing buys no feature the user values; the cost is a one-time first-launch friction prompt per platform that the README documents honestly. The signing pipeline (electron-builder hardened-runtime, `afterSign` notarize hook, `afterPack` fuses hook, Windows `azureSignOptions`) stays in tree dormant — re-activates the moment the maintainer pastes secrets in, no code change needed. This decision overrides the original 2026-05-06 "macOS first-class signed+notarized" stance.

## Distribution Channels

- **GitHub Releases** — primary and only channel for v1. Direct `.dmg` / `.AppImage` / `.deb` / `.exe` download from the public repo at `github.com/yarikleto/mnemo`.
- **No stores.** App Store and Microsoft Store add review friction, sandboxing constraints, and 30% revenue share — none of which serve a free, local-first, single-developer project. A small Linux audience may eventually want a Snap/Flatpak; until that demand exists, they can use the AppImage.

## Auto-Update Strategy

**`electron-updater` (≥ 6.3.9, CVE-2024-39698 floor) against GitHub Releases.** Free, no infrastructure to host, and — critically — supports macOS and Linux AppImage with unsigned builds. (Initial draft of this vision named `update.electronjs.org`; the architect overrode in ADR-006 because `update-electron-app` doesn't support Linux. The architect's call stands.) With unsigned builds the publisher comparison degenerates to null-vs-null and the verifier no-ops (per SPIKE-002). `verifyUpdateCodeSignature: true` stays on regardless — never disable it; if the maintainer ever signs, it's already armed.

Auto-update is **non-negotiable for v1**. A solo-maintainer desktop app where users get stuck on an old version is a support nightmare; silent in-the-background updates avoid that.

## App Lifecycle Mode

**Foreground app for v1.** User opens Mnemo when they want to review or author cards. Closing the window quits on Windows/Linux; on macOS the dock icon remains (standard mac convention).

**Background-resident with tray + due-card notifications is v2 territory** — it's the obvious next move for a daily-habit product, but it's a deliberate choice that affects window-state, sleep/wake handling, and the Linux tray story (notoriously fragmented across desktop environments). Capture the requirement, defer the build.

## Window Architecture

**Single window, hash-routed.** This matches the current code and is the right call: the app is a unified workspace (review / browse / dashboard / editor / settings) rather than a multi-document editor. SDI doesn't fit because there is no document — there's a vault. Tabbed doesn't fit because the user is in one mode at a time.

The architect should not change this without a strong reason.

## Core User Flows

### Flow 1: Review session (the daily ritual)
1. User launches Mnemo (Spotlight on mac, Start menu on Windows, app launcher on Linux).
2. App opens to `/review`, showing today's due card with the prompt revealed and the answer hidden.
3. User reads, recalls, presses Space to reveal the answer.
4. User rates 1–4 (Again / Hard / Good / Easy). FSRS schedules the next review.
5. App advances to next due card. Repeats until the queue is empty, then shows a "done" state.

### Flow 2: Authoring a new card from an editor
1. User opens VS Code on the vault folder.
2. Creates `cards/languages/japanese/joushiki.md` with the front-matter template.
3. Saves the file.
4. Mnemo (still running, or next launch) picks up the new card via the file watcher within ~1s — it appears in browse, in dashboard counts, and in the next review queue with a fresh FSRS state.
5. User can also edit the prompt text or body in VS Code; Mnemo reflects the change live.

### Flow 3: Sharing a deck with a friend
1. User opens the sidebar → Export.
2. Searches and multi-selects cards (tri-state checkboxes for whole namespaces).
3. Picks a destination — gets a single `.mnemo.zip` containing every selected card plus referenced assets.
4. Sends the zip over Slack / email / AirDrop.
5. Friend opens Mnemo on their machine → Sidebar → Import → picks the archive → previews card count → chooses target namespace → cards land in the friend's vault. Review state stays local.

## The 11-Star Experience

- **1-star:** Doesn't open. Crash on first launch, file watcher silently drops a card, auto-updater corrupts the install.
- **5-star:** Downloads, opens (one right-click on first launch is fine), vault picker works, review flow works, file watcher works, auto-updates silently on macOS + AppImage. README owns the first-launch friction honestly. (This is v1.)
- **11-star:** Feels like Bear-meets-Anki. Native window chrome on every OS. Spotlight-grade global "review now" hotkey. Native notifications when due cards stack up. Double-click `.mnemo.zip` in Finder to import. Drag a card file from Finder onto the dock to add it. Mac touchbar shortcuts for Again/Hard/Good/Easy. Multi-vault support so you can have separate vaults for "work" and "personal." iCloud/Dropbox sync just *works* because the vault is plain files. Plugin system so others can write custom widgets. Theme studio.

**v1 lives at 5-star.** v2 picks one or two 11-star moves and ships them.

## What Makes This Different

| | Anki | Obsidian + plugin | Web SR app | **Mnemo** |
|---|---|---|---|---|
| Cards as plain markdown files | No (`.apkg` blob) | Yes (notes are MD) | No | **Yes** |
| FSRS scheduler | Plugin | Plugin | Varies | **Built-in** |
| Edit in external editor | No | Yes | No | **Yes, live-watched** |
| Git-friendly vault | No | Yes | No | **Yes** |
| Local-first / no account | Mostly | Yes | No | **Yes** |
| Native desktop app | Yes (Qt) | Yes (Electron) | No | **Yes (Electron)** |
| Authoring-first UX | No | Yes | No | **Yes** |
| Free + open source | Yes | No (closed) | Varies | **Yes** |

The single line: **"Anki, but your cards are markdown files you own."** Everything else follows from that.

## What This Is NOT

- **Not a sync product.** No accounts, no cloud, no server. If users want sync, they put the vault in Dropbox/iCloud/Syncthing — that's their call, not Mnemo's responsibility.
- **Not a multi-user product.** One person, one vault. No sharing-of-progress, no leaderboards, no social.
- **Not an Anki importer.** Mnemo is the *destination* for users who want out of Anki, not a wrapper around `.apkg`. If the audience demands it, an importer can be a separate tool that emits markdown into a vault.
- **Not a mobile app.** Mobile is fundamentally a different surface (touch, no filesystem ownership, app store gauntlet). If Mobile-Mnemo ever exists, it's a separate product that reads a synced vault, not a port of this codebase.
- **Not a web app.** See "Why a Desktop App" — the live-editor-sync requirement makes web technically impossible.
- **Not a learning-content platform.** Mnemo doesn't host or distribute decks. Users share `.mnemo.zip` peer-to-peer; we don't run a marketplace.

## MVP Definition

The MVP is **a downloadable, auto-updating Mnemo on three platforms — all unsigned**, with first-launch friction documented honestly.

- macOS: `.dmg` from GitHub Releases. First launch is right-click → Open to clear Gatekeeper, once. README owns this.
- Linux: AppImage + `.deb` from GitHub Releases. AppImage needs `chmod +x`.
- Windows: NSIS `.exe` from GitHub Releases. SmartScreen "More info → Run anyway" on first install.
- First-run vault picker: a real onboarding screen that lets the user choose a vault before they hit the empty review screen. (Landed 2026-05-07.)
- Auto-update via `electron-updater` against GitHub Releases — wired, working on macOS + Linux AppImage, tested via at least one v0.0.x → v0.0.y round-trip on a packaged build before promoting to v1.0.0.
- All current features: review, browse, card-view, dashboard with 6 widgets, editor, settings, namespace tree, archive export/import, full-text search, file watcher.

If we're not slightly embarrassed by the right-click-to-open / SmartScreen / `chmod +x` first-launch friction, we launched too late.

## Verification Criteria

The spec is a contract. Each item below is observable by a human after using the product. The system design and tasks must trace back to these.

- [ ] **VC-1** A new user can download the macOS `.dmg` from GitHub Releases, drag Mnemo to Applications, right-click → Open once to clear the Gatekeeper prompt, and reach the onboarding screen in under 90 seconds. (Right-click is required only on the first launch; subsequent launches are silent.)
- [ ] **VC-2** First-run UX: on launch with no vault configured, the user sees an onboarding screen that lets them pick a folder. After picking, the app navigates to `/review` (empty state) without further setup.
- [ ] **VC-3** Editing a card's markdown in an external editor (e.g. VS Code) updates the in-app view (browse list, dashboard counts, review queue if applicable) within 1 second of save, without the user reloading the window.
- [ ] **VC-4** Closing and reopening the app preserves the vault selection and the last visited route, on the same display the user last used.
- [ ] **VC-5** When a new release is published to `github.com/yarikleto/mnemo/releases`, a running Mnemo instance prompts the user to update within 24 hours and applies the update on next quit/relaunch.
- [ ] **VC-6** Mnemo launches and the full review flow works (load due queue → reveal answer → rate → next card) with no internet connection.
- [ ] **VC-7** The vault folder remains a plain folder of markdown files at all times: the user can `cd` into it, `git init` it, edit any `.md` in any editor, and Mnemo continues to work. Mnemo never adds opaque binary state inside `cards/`.
- [ ] **VC-8** Exporting a 5-card pack as `.mnemo.zip` and importing it on a different Mac reproduces all 5 cards (front-matter + body + referenced assets) in the target namespace. Review state is intentionally not transferred.

## Pre-Mortem

Imagine v1 ships and adoption stalls. Top 3 risks:

1. **First-launch friction looks scarier than it is.** Decision shifted 2026-05-07: every platform shows a one-time prompt (Gatekeeper "right-click → Open", SmartScreen "More info → Run anyway", AppImage `chmod +x`). The bet is that the technically-pedantic v1 audience has clicked through these prompts dozens of times for other niche tools and won't be put off by ours. **Mitigation:** README owns the friction directly with the exact wording the user will see — no surprises. If the audience proves to actually bounce on these prompts, the signing pipeline is wired and waits behind a single secret-paste step; flipping is a one-day reversal, not a re-architecture.

2. **Auto-update breaks silently and users get stranded on a buggy v1.0.0.** `electron-updater` is reliable but the *first* end-to-end auto-update requires a real release-day rehearsal; if v1.0.0 → v1.0.1 doesn't actually round-trip, users won't tell us — they'll just stay on v1.0.0 and rate the app one star when they hit a bug we already fixed. With unsigned builds the publisher comparison degenerates to null-vs-null (per SPIKE-002), so the verifier no-ops — benign but means a subtle break would slip past unit tests. **Mitigation:** the walking skeleton must include a v0.0.1 → v0.0.2 auto-update test before any feature work; tester verifies on packaged builds, not dev mode.

3. ~~**Onboarding cliff kills first-impression.**~~ — **MITIGATED 2026-05-07.** First-run vault picker landed: the welcome screen offers `~/Documents/mnemo` as the default plus a "Choose a folder…" button. Existing-user upgrades get a silent backward-compat migration (no onboarding for them).

## Open Questions

- **Tray + notifications — v2 yes, or never?** Habit products live or die on the nudge. But cross-platform tray on Linux is a bog. Decide at the v2 kickoff, not now.
- **Anki importer — separate tool or no?** The audience that wants this most loudly may not be the audience we serve best. Watch GitHub issues; build only on demand.
- **Multi-vault support — v2 or v3?** "Work" and "personal" vaults is a real ask. Today the vault is a single config field. Restructuring config to support N vaults is small; the UX of switching mid-session is the harder question.
- **Plugin system — never, probably.** Plugin systems are a permanent maintenance liability. The vault-as-plain-files design already gives users plenty of escape valves.
- **Telemetry — never.** Document this loudly. Local-first ethos.
