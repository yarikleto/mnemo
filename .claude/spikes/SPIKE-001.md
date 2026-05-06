# SPIKE-001 — `electron-updater` on Linux AppImage

> Time-boxed: 1 day. Resolves before TASK-014 finalises the Linux UX surface.

## Question

Does `electron-updater@^6.3.9` reliably update an AppImage in place on Ubuntu 22.04 and 24.04 GNOME / KDE?

## Findings (research-tier; needs the v0.0.x → v0.0.y rehearsal to confirm)

- `electron-updater` ships an `AppImageUpdater` provider that **does** support in-place AppImage updates. The mechanism: it downloads the new AppImage next to the running one, then `process.exec`-replaces the file via `unlink + rename` and triggers a self-relaunch.
- Hard requirement: the AppImage must have been launched from a **writable filesystem path** (the user's `~/Applications/`, `~/Downloads/`, or a custom dir). If the user mounted the AppImage from a read-only medium (rare — happens when a desktop integration tool drops it under `/usr/local/bin` and chmods 555), the updater errors out and the user has to download manually.
- Both GNOME and KDE handle the post-update relaunch transparently. No platform-specific code needed.
- Required env: the running AppImage process exposes `APPIMAGE` (path to the bundle) and `APPDIR` (mount point) env vars; `electron-updater` uses them. No extra config required from us.
- The AppImage's signature is **not** verified (we ship Linux unsigned). `electron-updater` correctly skips signature verification on Linux when no `latest-linux.yml` `sha512` is present in the publish flow — but our flow does include sha512 (electron-builder writes it), so the integrity check happens against the publisher's hash.

## Decision

- **Wire AppImage auto-update on by default.** ADR-006's "auto-update for Linux is best-effort" stays accurate: if the user's filesystem placement is unusual it falls back to manual; in the common case it just works.
- **`.deb` users get manual-download.** No in-place auto-update for `.deb` (apt is the system update mechanism); the README documents this.

## Open follow-ups

- The actual round-trip rehearsal (TASK-018-equivalent for Linux) confirms this on a fresh Ubuntu 24.04 LTS install. Do this once the macOS round-trip is green so we don't conflate failure modes.
- Watch for upstream `electron-updater` issues tagged `appimage` — there have been a few "AppImage relaunch fails when the new bundle was renamed by the desktop file manager" bugs over the years; pin the version conservatively.
