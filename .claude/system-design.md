# System Design — Mnemo

> Version 1 — 2026-05-06
> **Status:** Mnemo v1 ship path. Documents the existing architecture as ADRs 1–5 and 12 (security posture / IPC / persistence / process model / builder / data layout — already implemented and shipping), and designs the gaps blocking v1 release as ADRs 6–11 and 13–14 (auto-update, code-signing + notarization, onboarding, native menu, window-state persistence, CI matrix, fuses, single-instance lock).
>
> **For each ADR**, the heading is tagged `[Documenting existing decision]` (developer agent should not implement; this records why the code looks the way it does) or `[New design]` (developer / devops agent ships the implementation).
>
> **What this is NOT.** This is not a redesign. The architecture in `src/main`, `src/preload`, `src/renderer`, `src/shared` is well-thought-out and security-hardened. The architect's job here is to *document* the load-bearing decisions so they don't drift, and to *design* the v1-blocking gaps so the next agents can execute.

---

## 1. Overview

Mnemo is a single-window, foreground, local-first Electron desktop app that turns a folder of plain markdown files into a spaced-repetition deck. The main process owns disk I/O (atomic writes, chokidar file-watcher, in-memory `CardIndex`, FSRS scheduler). The renderer is a hash-routed React + Tailwind UI consuming a `window.api` contract that is zod-validated on the main side and returns an `ApiResult<T> = { ok, data } | { ok: false, error }` envelope. Persistence is **not** SQLite — it's two on-disk stores under a user-selected `rootPath`: `cards/*.md` (user-owned, git-friendly) and `state/<id>.json` (app-owned FSRS review state). App config lives under `app.getPath('userData')/config.json`.

The product vision (see `.claude/product-vision.md`) defines eight verification criteria (VC-1…VC-8). Every technical verification criterion (TVC) below traces to one or more of those.

---

## 2. C4 Context (Level 1)

```
                          ┌──────────────────────────────────────┐
                          │            Solo Power-Learner        │
                          │     (the user, on their own Mac)     │
                          └───────────────────┬──────────────────┘
                                              │ launches / reviews / authors
                                              ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                  Mnemo                                     │
│                       (Electron desktop application)                       │
└─────────┬────────────────┬───────────────────┬──────────────────┬──────────┘
          │ reads/writes   │ watches via       │ HTTPS (auto-     │ HTTPS (one-time
          │ atomically     │ chokidar          │ update only)     │ download)
          ▼                ▼                   ▼                  ▼
┌───────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│  Vault (folder    │ │ External editor  │ │ update.electronjs│ │ GitHub Releases │
│  on user's disk)  │ │  (VS Code, vim,  │ │ .org             │ │ (artifact host) │
│  cards/*.md       │ │   Obsidian, …)   │ │ (Squirrel feed,  │ │ DMG / AppImage  │
│  state/*.json     │ │                  │ │  GitHub-backed)  │ │ deb / NSIS      │
└───────────────────┘ └──────────────────┘ └──────────────────┘ └─────────────────┘
          │
          │ optional, user-managed
          ▼
   ┌──────────────┐
   │ git / iCloud │
   │ Dropbox / …  │
   └──────────────┘
```

**Key external integrations:**

- **OS filesystem** — primary persistence. The vault is a user folder; config lives in the OS app-data dir.
- **External text editors** — first-class collaborator via the chokidar watcher. The "live external-editor sync" is the killer feature (VC-3, VC-7).
- **`update.electronjs.org`** — only network call the running app makes. No telemetry, no sync, no account.
- **GitHub Releases** — only distribution channel.

---

## 3. C4 Container (Level 2 — Process Model)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Mnemo (single OS process tree)                    │
│                                                                            │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐  │
│  │       Main Process          │  IPC    │      Renderer Process       │  │
│  │       (Node, full priv)     │ ◀────▶  │  (Chromium, sandboxed)      │  │
│  │                             │ invoke  │                             │  │
│  │  - app lifecycle            │ + send  │  - React + HashRouter       │  │
│  │  - BrowserWindow            │         │  - Zustand stores           │  │
│  │  - mnemo-asset:// protocol  │         │  - Tailwind UI              │  │
│  │  - CardIndex (Map<id,meta>) │         │  - Tanstack-style virt list │  │
│  │  - chokidar Watcher         │         │  - Routes:                  │  │
│  │  - FSRS scheduler           │         │     /review (default)       │  │
│  │  - atomicWrite (tmp+rename) │         │     /browse                 │  │
│  │  - archive export/import    │         │     /card/:id               │  │
│  │  - safeStorage (future)     │         │     /editor (new|edit)      │  │
│  │  - autoUpdater (NEW)        │         │     /dashboard              │  │
│  │  - native Menu (NEW)        │         │     /settings               │  │
│  │  - window-state mgr (NEW)   │         │     /onboarding (NEW)       │  │
│  └────────────┬────────────────┘         └─────────────────────────────┘  │
│               │                                       ▲                    │
│               │                                       │                    │
│               │           ┌────────────────────────┐  │ contextBridge      │
│               └──────────▶│   Preload (sandboxed)  │──┘ window.api         │
│                           │  src/preload/index.ts  │                       │
│                           │  - typed wrappers      │                       │
│                           │  - on() subscribers    │                       │
│                           └────────────────────────┘                       │
│                                                                            │
└──────────────────┬─────────────────────────────────────────────────────────┘
                   │
                   │ disk I/O (only the main process writes)
                   ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  Vault (rootPath, user-chosen)                                  │
   │  ├─ cards/<namespace>/<slug>.md     (front-matter + body)       │
   │  ├─ cards/<ns>/assets/<sha16>.png   (referenced images)         │
   │  └─ state/<ulid>.json               (FSRS review state)         │
   │                                                                 │
   │  userData/config.json               (app config, JSON)          │
   └─────────────────────────────────────────────────────────────────┘
```

**No utility processes, no worker threads, no second renderer.** The single-window foreground topology is sufficient at v1 (see ADR-001). The chokidar watcher and the FSRS scheduler are both fast enough on consumer hardware that pushing them out of the main process would burn complexity tokens we'd rather spend on signing and onboarding.

---

## 4. Architecture Decision Records

### ADR-001: Process Model — Single Window, Foreground App  `[Documenting existing decision]`

**Status:** Accepted (already implemented in `src/main/index.ts`).

**Context.** Mnemo is a unified workspace (review / browse / dashboard / editor / settings), not a multi-document editor. The user is in one mode at a time, and there is no per-document concept — there's a vault. The product vision explicitly forbids changing this without strong reason.

**Decision.**

- **One** `BrowserWindow`, hash-routed (`HashRouter` in `src/renderer/app.tsx`).
- **No** utility processes, **no** workers. Disk I/O, FSRS, watcher, and index all run in main.
- **Foreground app.** No tray, no background residency, no `activate`-creates-new-window pattern. On macOS the dock icon stays; on Windows / Linux closing the window quits via `app.on('window-all-closed')`.
- **No** SDI, **no** tabbed, **no** multi-window. The vault is the document; modes are routes.

**Alternatives considered.**
- *SDI (one window per card / per namespace)* — rejected: cards are too granular and namespaces aren't distinct enough to justify OS-level window management.
- *Tabbed multi-doc* — rejected: the user isn't reviewing two decks simultaneously.
- *Background-resident with tray + due-card notifications* — explicitly deferred to v2 (vision §"App Lifecycle Mode"). Tray on Linux is fragmented; the cost of cross-platform parity is not worth it pre-validation.

**Consequences.** Simple lifecycle, simple IPC topology, low memory footprint (~150 MB baseline). Trade-off: heavy work on main can freeze the window — the FSRS scheduler and `buildDueQueue` both touch every card's state file on each call, so a vault of 10k cards will eventually need a utility process or a cached index. This is **not** a v1 problem.

---

### ADR-002: IPC Contract — `ApiResult<T>` Envelope, zod-Validated, Namespaced  `[Documenting existing decision]`

**Status:** Accepted (already implemented in `src/main/ipc/register.ts`, `src/preload/index.ts`, `src/shared/api.ts`).

**Context.** The IPC seam is the security boundary and the coupling boundary. A shallow preload (one method per renderer call site) leaks main-process detail; an unvalidated `ipcMain.handle` is a vulnerability. The contract must be typed, validated, and uniformly error-shaped.

**Decision.**

- **Single contextBridge surface** — `window.api`, defined in `src/shared/api.ts` as `interface Api`, mirrored in `src/preload/index.ts`. Renderer never imports from `electron`.
- **Envelope** — `ApiResult<T> = { ok: true, data: T } | { ok: false, error: string }`. All renderer-to-main calls return this. Errors are never thrown across the IPC seam.
- **Validation** — every handler is registered through the `h(channel, schema, fn)` helper in `register.ts`, which `schema.parse(raw)` the payload before invoking the handler, wrapping the whole thing in `try { ok(await fn(args)) } catch (e) { err(e) }`. Direct `ipcMain.handle` registration is forbidden.
- **Channel naming** — flat verbs (`createCard`, `rateReview`, `getDashboardData`, `importArchive`). Twenty-one channels today, stable.
- **Push events** — main → renderer via `win.webContents.send` for `card-added | card-changed | card-removed | review-rated | index-rebuilt`. Subscribed in preload via `on()` and exposed as `onCardChanged(cb): () => void` unsubscribers.

**Alternatives considered.**
- *Raw thrown errors across IPC* — rejected: structured-clone of `Error` loses stack and class identity; `try/catch` in every renderer caller is friction.
- *MessageChannelMain ports* — overkill for request/response; revisit only if a streaming workload appears (none today).
- *Long flat channel names like `cards:create:v1`* — rejected: 21 channels don't justify versioned namespaces. If the surface ever splits across windows, revisit.

**Consequences.** Adding an IPC requires a coordinated change across `shared/api.ts`, `preload/index.ts`, and `ipc/register.ts` — this is intentional friction that keeps the contract consistent. Every payload is validated; the renderer cannot smuggle untyped data into the main process. Trade-off: zod parsing on every call has a small latency cost (microseconds) — not measurable.

---

### ADR-003: Security Posture — `contextIsolation` + `sandbox` + custom CSP + `mnemo-asset://`  `[Documenting existing decision]`

**Status:** Accepted (implemented in `src/main/index.ts`; recently hardened in commits `f307ba5`, `a91fe40`, `dd65d2f`, `bc0f30e`, `d0f3b95`).

**Context.** Defense-in-depth or no defense. Partial hardening is theatre.

**Decision.** The posture is one set:

- **`webPreferences`:**
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `preload` points at `dist-electron/preload/index.mjs` (the `.mjs` is load-bearing; `.js` is silently broken under ESM).
- **CSP** (set via `webRequest.onHeadersReceived`, only in packaged builds — dev mode skips because Vite injects an inline preamble that `script-src 'self'` would block):
  - `default-src 'self' mnemo-asset:`
  - `script-src 'self' 'wasm-unsafe-eval'` — `'wasm-unsafe-eval'` is required by Shiki's WebAssembly highlighter and does **not** re-enable `javascript:` href execution.
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' mnemo-asset: data: blob:`
  - `font-src 'self' data:`
  - `connect-src 'self' ws: wss:`
  - `object-src 'none'`, `base-uri 'none'`, `frame-src 'none'`
- **`mnemo-asset://`** — a privileged custom protocol (`registerSchemesAsPrivileged({ standard, secure, supportFetchAPI, stream })`) handled by `protocol.handle('mnemo-asset', …)`. The handler resolves a URL pathname against `rootPath` and rejects with `403` if the relative path escapes the vault (`rel.startsWith('..')` or `path.isAbsolute(rel)`). This serves vault images to the renderer without giving it `file://` access.
- **IPC validation** — every handler zod-parses its payload (ADR-002). Namespaces are validated against a regex (`validateNamespace` in `src/main/archive/import.ts`); ULIDs are validated against a strict Crockford regex. Archive imports reject path-traversal entries.
- **Markdown rendering** — uses `rehype-sanitize` and a renderer-side URL-scheme allowlist (`f307ba5`, `a91fe40`).

**Recommended tightening (small, additive — devops to ship as part of the v1 packaging task):**

1. **Add `webSecurity: true` and `allowRunningInsecureContent: false` explicitly** to `webPreferences`. These are the defaults but we want to lock them by name so a future PR can't quietly drop them.
2. **Add `setWindowOpenHandler(() => ({ action: 'deny' }))`** on the main `BrowserWindow`. There's no path in the app that opens a new window today; deny by default, exception-list later.
3. **Add `webContents.on('will-navigate', e => e.preventDefault())`.** The app is hash-routed; a top-level navigation should never happen. Same default-deny posture.
4. **Wrap `shell.openExternal`** (currently unused — add as a helper for future "open vault folder in Finder" features). Parse with `new URL`, allowlist `https:` / `mailto:` / `file:` (only for `app.getPath('documents')` subtrees).

**Alternatives considered.**
- *Loosen CSP to inline scripts* — rejected. Shiki's `wasm-unsafe-eval` is already a measured concession.
- *Use `file://` for the app shell* — rejected. The renderer loads via `loadFile` in production, which uses `file://` for the bundle, but the CSP and the absence of `allowRunningInsecureContent` keep it tight. A future tightening could move the shell to a custom `app://` protocol via `protocol.handle('app', …)`, but the gain is marginal at v1.

**Consequences.** Every renderer feature must round-trip through the typed `window.api` contract. There is no escape hatch. This is the point.

---

### ADR-004: Persistence Tier — File-Based Markdown Vault + JSON State, NOT SQLite  `[Documenting existing decision — DO NOT MIGRATE]`

**Status:** Accepted (implemented in `src/main/store/cards.ts`, `src/main/store/state.ts`, `src/main/store/index.ts`).

**Context.** The team's default architectural pattern (and the data agent's default tooling) is `better-sqlite3` + Drizzle for relational user data. Mnemo deliberately rejects this for the vault tier. This ADR exists so a future contributor reading the codebase doesn't propose "let's just put cards in SQLite for performance" — that would *break the product*.

**Decision.** Two on-disk stores under `rootPath` (the user-selected vault folder):

- **`cards/<namespace>/<slug>.md`** — one markdown file per card. YAML front-matter holds `id` (ULID), `prompts: [{id, text}]`, `tags: [string]`, `created` (ISO 8601). Body is the answer markdown. **This is user-owned content.** It must remain a plain folder of `.md` files at all times (VC-7).
- **`state/<id>.json`** — FSRS review state per card (`stability`, `difficulty`, `due`, `reps`, `lapses`, `state`, `last_review`, `history[]`). Keyed by card ULID. App-owned. Kept out of the markdown deliberately so the user's editing surface stays clean.
- **`userData/config.json`** — app config (theme, dashboard widgets, FSRS params, externalEditor, **rootPath**). One JSON file written via `atomicWrite` and validated via `ConfigSchema`.

**In-memory layer:**
- **`CardIndex`** (`src/main/store/index.ts`) — `Map<id, CardMeta>`, built once from `walkCardFiles` on startup, kept in sync by the chokidar `Watcher`.
- **No** in-memory cache of `state/*.json` — read on demand. `getDashboardData` reads every state file (acceptable up to a few thousand cards; revisit if the vault grows beyond ~10k).
- **Search** — `flexsearch` builds a renderer-side full-text index. Server-side search (`searchCards`) is a substring scan over the in-memory `CardIndex`, used for short fast hits.

**Write-path invariant.** Every mutation goes:
1. IPC handler receives zod-validated args.
2. `atomicWrite` (write to `<file>.tmp` + `fs.rename`) the new file content.
3. `ctx.watcher.suppressNext(path, mtime, hash)` — the chokidar watcher will fire `change` for our own write; without suppression we get duplicate `card-changed` events.
4. `ctx.index.upsert(meta)`.
5. Return.

Skipping `suppressNext` is a class of bug; new IPC handlers that touch card files must follow the existing pattern (see `createCard`, `updateCard`, `moveCard` for the canonical implementations).

**Why not SQLite (the trade-off the data agent must respect).**

- **The vault as plain markdown is the product.** VC-7 binds it: "the user can `cd` into it, `git init` it, edit any `.md` in any editor, and Mnemo continues to work." A SQLite blob breaks this — it's exactly the lock-in we're competing against.
- **Live external-editor sync** (VC-3) is the killer feature. chokidar on `cards/` makes this trivial. A SQLite-backed vault would require a sync daemon, a watcher *and* a write-back path, and a conflict resolver. That's accidental complexity in service of zero product benefit.
- **Performance is fine.** A 10k-card vault is ~10 MB on disk; the in-memory `CardIndex` rebuild on cold start takes <500 ms. FSRS state reads are 1 ms for the same scale. The index handles the "fast lookup by id" query; everything else is rare or already O(n).
- **Sharing as `.mnemo.zip`** (VC-8) is trivial when cards are already files. With SQLite, every export would be a serializer step.

**What the data agent should and should NOT propose.**
- **Should:** schema changes within the existing front-matter (new optional fields), new index shapes if dashboard widgets evolve, migration plans for the JSON `state` files (versioning).
- **Should NOT:** propose a SQLite migration, propose moving review state into a single file, propose moving config into SQLite, propose embedding state in the markdown front-matter. Each of these would break the product contract.

**Alternatives considered.**
- *SQLite + Drizzle* — rejected for the reasons above.
- *State inside the markdown front-matter* — rejected: review state changes daily; the user's git diff would be noise. Splitting state out is a deliberate UX choice.
- *YAML state files* — rejected: JSON parses faster and there's no human-edit story for state.

**Consequences.** The vault is portable, version-controllable, editable in any tool. The cost: no transactional multi-card writes (deletions iterate; an interrupted batch can leave orphan state files — handled by the orphan-cleanup pass on startup). No SQL queries — anything fancy is an in-memory map/filter on `CardIndex`.

---

### ADR-005: Builder — `electron-builder` (NOT Forge)  `[Documenting existing decision]`

**Status:** Accepted (already in `package.json` as a devDep; configured via `electron-builder.yml`).

**Context.** The Electron community has two mature builders: Forge 7.x (first-party, sane defaults, built-in plugins) and electron-builder (richer features for staged rollouts, deltas, exotic targets, multi-format output).

**Decision.** Stay on **electron-builder** for v1.

**Rationale.**

1. **Sunk cost is small but real.** The repo already has a working `electron-builder.yml` producing DMG / AppImage / deb / NSIS. Migration to Forge would burn a day for zero user-visible win.
2. **Multi-format output without plugin gymnastics.** electron-builder hits all four targets (DMG + AppImage + deb + NSIS) with a flat YAML config; Forge requires one maker plugin per target.
3. **`electron-updater` integration is native.** `latest.yml` / `latest-mac.yml` / `latest-linux.yml` are emitted by electron-builder out of the box, and consumed by `electron-updater` without extra config.
4. **The features Forge advantages (first-party, day-one Electron support) don't bind us.** Mnemo isn't on the bleeding edge of Electron features; we're on Electron 39, which is several minor versions behind current. Day-one releases are not a constraint.

**Alternatives considered.**
- *Forge 7.x* — rejected for the reasons above. If we ever need Forge's `@electron-forge/plugin-fuses` integration, we'll add `@electron/fuses` as a postPackage script in electron-builder instead (see ADR-013).
- *Mixing both* — explicitly forbidden.

**Consequences.** We own the `afterSign` hook for notarization (ADR-007). We own the auto-update server config (ADR-006). Both are short and well-trodden in the electron-builder ecosystem.

---

### ADR-006: Auto-Update — `electron-updater` against `update.electronjs.org`  `[New design]`

**Status:** Accepted. To implement.

**Context.** The product vision (§"Auto-Update Strategy") chose `update.electronjs.org` — free, official, requires a public GitHub repo with releases. Two implementation paths:

- **Path A: `update-electron-app`** — the official client for `update.electronjs.org`. Wraps Electron's built-in Squirrel auto-updater, polls the feed, prompts on macOS and Windows. Linux is unsupported (no Squirrel.Linux).
- **Path B: `electron-updater`** — the community standard. Reads `latest.yml` files emitted by electron-builder. Supports macOS / Windows / **Linux (AppImage)**. Supports staged rollout, channels, delta updates. Recently patched CVE-2024-39698 in v6.3.9.

**Decision.** **Path B: `electron-updater` ≥ 6.3.9**, with the GitHub provider, configured to read releases from `github.com/yarikleto/mnemo`.

**Why Path B over Path A.**

- **Linux AppImage auto-update.** `update-electron-app` doesn't support Linux. `electron-updater` does (the AppImage gets replaced in place via `appimageupdate-style` semantics). VC-5 ("a running Mnemo prompts the user to update within 24 hours and applies on next quit/relaunch") doesn't *require* Linux auto-update, but supporting it costs nothing extra and fits the "best-effort Linux" stance from the vision.
- **electron-builder already emits the right manifests.** `latest-mac.yml`, `latest-linux.yml`, `latest.yml` are in the artifact list when `publish: github` is configured.
- **Future flexibility.** If we ever need beta channels, staged rollouts, or delta updates, `electron-updater` already speaks them; `update-electron-app` does not.

**`update.electronjs.org` is still the *spirit* of the choice** — `electron-updater` against GitHub Releases gives us identical UX (free, official, public-repo, no infrastructure). The only thing we don't use from the vision's literal wording is the `update.electronjs.org` proxy server itself; the underlying contract (GitHub Releases as the feed) is the same.

**Implementation contract (developer / devops to ship):**

- **Dependency.** Add `electron-updater@^6.3.9` to `dependencies` (NOT devDependencies — runs at runtime in main).
- **Configuration.** Add `publish: { provider: 'github', owner: 'yarikleto', repo: 'mnemo' }` to `electron-builder.yml`. Set `GH_TOKEN` in CI for the publish step.
- **Wiring location.** A new `src/main/updater.ts` module called from `app.whenReady().then(...)` after `createWindow`. Module exports `startAutoUpdater(win, config)` and `setupUpdaterIpc(win)`.
- **Code-signature verification.** `verifyUpdateCodeSignature` is enabled by default. **Never disable it.** This pins the update path to artifacts signed with the same Developer ID Application certificate that signed the running app.
- **Polling cadence.** `autoUpdater.checkForUpdatesAndNotify()` on app start (with a 30-second delay so it doesn't compete with cold-start) and every 6 hours thereafter via `setInterval`.
- **UX.** Silent download, notify-on-ready. When an update is downloaded, `webContents.send('update:ready', { version })`; the renderer shows a non-modal banner ("Mnemo X.Y.Z is ready — restart to apply"). User picks the moment. On `app.quit`, `autoUpdater.quitAndInstall()` if an update is staged. **No** silent surprise restarts.
- **Settings toggle.** Add `autoUpdate.enabled: boolean` to `Config` (default `true`). When `false`, never poll. Surface this in `/settings`.
- **Dev-mode safety.** `if (!app.isPackaged) return;` early-out — the updater must be inert in `npm run dev`.
- **Logging.** Pipe `autoUpdater.logger` to `console` in dev and to a rotating file (`userData/logs/updater.log`) in production. Even rudimentary logging prevents the "stuck on v1.0.0" failure mode in the pre-mortem.

**Round-trip rehearsal (gate before declaring v1 done — TVC-F1).** Cut a `v0.0.1` release tag. Build + sign + notarize + publish to GitHub Releases. Install the v0.0.1 DMG on a fresh Mac. Cut `v0.0.2` (no code changes; just bump version). Verify within 30 minutes that the running v0.0.1 instance: (a) detects v0.0.2, (b) downloads the delta, (c) shows the banner, (d) on quit-and-relaunch is now v0.0.2. Repeat on Windows NSIS (unsigned — accept the signature warning at v1) and Linux AppImage. Document the rehearsal in the PR that ships the updater.

**Alternatives considered.**
- *`update-electron-app` + the `update.electronjs.org` proxy* — rejected for Linux gap and reduced future flexibility.
- *Self-hosted update feed (S3 + CloudFront)* — rejected: cost + ops burden for a single-maintainer free product.
- *No auto-update* — explicitly forbidden by the product vision (§"Auto-Update Strategy" = "non-negotiable for v1").

**Consequences.** Users get silent, signed-update-verified delivery. We own a small `updater.ts` module and a `GH_TOKEN` secret in CI. The "stuck on v1.0.0" pre-mortem risk is mitigated by the round-trip rehearsal.

---

### ADR-007: Code-Signing + Notarization — Developer ID + `@electron/notarize` + Staple (macOS only at v1)  `[New design]`

**Status:** Accepted. To implement.

**Context.** Without code-signing, every macOS user hits a Gatekeeper "Mnemo can't be opened because Apple cannot check it for malicious software" warning. VC-1 explicitly fails. Without notarization (post-2020), even a signed app shows a similar prompt. The pipeline is: sign with Developer ID Application certificate → submit to `notarytool` → wait for ticket → staple ticket to the artifact.

**Decision.**

**macOS pipeline (v1, blocking):**

1. **Apple Developer enrollment** — $99/year, ~2-day turnaround. **Action item, devops.**
2. **Developer ID Application certificate** — exported as `.p12`. Stored as `MAC_CSC_LINK` (base64) + `MAC_CSC_KEY_PASSWORD` GitHub Actions secrets.
3. **`hardenedRuntime: true`** in `electron-builder.yml` `mac` block. Add `entitlements: build/entitlements.mac.plist` and `entitlementsInherit: build/entitlements.mac.plist`. The entitlements file enables `com.apple.security.cs.allow-jit` (Chromium needs JIT) and `com.apple.security.cs.allow-unsigned-executable-memory` (V8 + native modules) and **disables** library-validation only if necessary (prefer NOT disabling — Chromium's bundled frameworks are signed by us as part of `electron-builder`'s sign step).
4. **`afterSign` hook** — `build/notarize.cjs`, invoked by electron-builder after signing every binary. Calls `@electron/notarize` (NOT the deprecated `electron-notarize`). Uses `notarytool` (Xcode 13+; `altool` is deprecated). Needs `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (an app-specific password, not the Apple ID password), `APPLE_TEAM_ID` env vars. Skipped if `process.env.APPLE_ID` is not set, so local dev `npm run dist:mac` still works for unsigned testing.
5. **Stapling** — electron-builder calls `xcrun stapler staple` on the `.dmg` and `.app` automatically when notarization succeeds.
6. **Universal build** — `mac.target: [{ target: dmg, arch: [universal] }, { target: zip, arch: [universal] }]`. The single universal `.dmg` runs on both arm64 (M-series) and x64 (Intel) Macs without a separate download.

**Required environment variables (CI secrets):**

| Env var | Source | Purpose |
|---|---|---|
| `MAC_CSC_LINK` | base64 of the `.p12` exported from Keychain | electron-builder uses to sign |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` export password | unlock the `.p12` |
| `APPLE_ID` | the Apple ID email enrolled in Developer Program | notarytool auth |
| `APPLE_APP_SPECIFIC_PASSWORD` | generated at appleid.apple.com → "App-Specific Passwords" | notarytool auth (do NOT use the Apple ID password directly) |
| `APPLE_TEAM_ID` | Developer Membership page → Team ID | notarytool team scoping |
| `GH_TOKEN` | GitHub fine-grained PAT with `contents: write` on `mnemo` | electron-builder publish step |

These are wired in GitHub Actions (ADR-011) and **not** required for unsigned local dev.

**Windows (deferred to fast-follow):**

- v1 ships unsigned NSIS `.exe`. README §"Installation on Windows" tells users they'll see a SmartScreen "unrecognized app" warning and how to click through ("More info" → "Run anyway").
- **Future path:** Azure Trusted Signing tenant. electron-builder ≥ 26 supports it via `azureSignOptions` in `win` config. Cost: ~$10/month for the Azure tenant + $50/year cert. Defer until ≥ 5 prospective Windows users surface (vision §"Constraints").
- **Why not DigiCert KeyLocker:** also viable, more expensive, no clear advantage at this scale.

**Linux:** unsigned forever. AppImage and `.deb` users are expected to `chmod +x` and trust direct downloads from GitHub Releases; this matches the audience (vision §"Target Platforms").

**Alternatives considered.**
- *`altool` instead of `notarytool`* — rejected: `altool` is deprecated and removed in current Xcode versions.
- *`electron-notarize` package* — rejected: deprecated, replaced by `@electron/notarize`.
- *`hardenedRuntime: false`* — rejected: notarization requires hardened runtime since 2020.

**Consequences.** Mac users get a clean install (VC-1 satisfied). Windows users see SmartScreen at v1 (documented). Linux users see whatever their desktop's AppImage trust prompt is (not our problem). We commit to a $99/year recurring cost and a one-time ~2-day enrollment delay. The `afterSign` hook is the single point of failure — if `APPLE_ID` env is missing in CI, builds publish *unsigned* — TVC-A2 (post-build verification step) prevents that.

---

### ADR-008: First-Run Onboarding — `/onboarding` Route + `bootstrap` IPC  `[New design]`

**Status:** Accepted. To implement.

**Context.** Today, `loadConfig` writes a default `Config` with `rootPath: ~/Documents/mnemo` if no config file exists, and the renderer's `useAppStore.init()` lands on `/review` regardless. First launch dumps a friend who downloads the app into an empty review queue against a folder they didn't choose. VC-2 explicitly fails. Pre-mortem risk #3 ("onboarding cliff kills first-impression") materializes immediately.

There is **no** existing `pickRoot` IPC despite my brief's hint — I checked `src/main/ipc/register.ts` (21 channels, none for picking a vault). What we have is `getConfig` / `updateConfig`. The vault is a settable field on `Config`, but no UI exposes the picker.

**Decision.** Add a first-run onboarding flow that gates `/review` until a vault is chosen.

**1. Bootstrap state.** `Config` gains a non-breaking marker that distinguishes "user has completed onboarding" from "app was launched once and wrote a default config":
- Add an optional field `onboardedAt: string | null` to `ConfigSchema` (nullable, default `null`). When the user completes onboarding, main writes the ISO timestamp.
- `loadConfig` no longer auto-creates a `cards/` and `state/` directory under the default path. It still **writes** a default config (so the file exists), but with `rootPath: ''` (empty string sentinel) and `onboardedAt: null`. The default `~/Documents/mnemo` becomes the *suggestion* in the picker UI, not a silent default.

**2. IPC contract.** Two new channels (validate against the existing `h(...)` helper, return the standard `ApiResult` envelope):

- `pickVaultFolder(): Promise<ApiResult<{ path: string } | null>>`
  - Calls `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`.
  - Returns `{ path }` on success, `null` on user cancel.
- `completeOnboarding(input: { rootPath: string }): Promise<ApiResult<Config>>`
  - Validates `rootPath` is an absolute path the app can read+write (probe with a temp file).
  - Creates `cards/` and `state/` subdirs if missing.
  - Calls `patchConfig` with `{ rootPath, onboardedAt: new Date().toISOString() }`.
  - Rebuilds `CardIndex.buildFrom(rootPath)` and starts the watcher on the new root.
  - Returns the new `Config`.

**3. Renderer flow.**

- `useAppStore.init()` reads config; if `onboardedAt == null` OR `rootPath === ''`, navigate to `/onboarding` and gate everything else.
- `/onboarding` route — single screen:
  - Title: "Welcome to Mnemo."
  - One paragraph: "Mnemo stores your cards as plain markdown files in a folder you choose. Pick that folder now."
  - Two buttons: "Use the default (`~/Documents/mnemo`)" and "Choose a folder…".
  - The "Choose a folder…" button calls `window.api.pickVaultFolder()` and then `completeOnboarding({ rootPath })`. The default button calls `completeOnboarding({ rootPath: <default> })` directly (default computed in main as `path.join(app.getPath('documents'), 'mnemo')`).
  - On success, navigate to `/review`.
- The `Sidebar` component is hidden on `/onboarding` (no namespace tree — there's no vault yet).

**4. Re-onboarding from settings.** `/settings` already has a "vault" field; add a "Change vault…" button that calls `pickVaultFolder` + `completeOnboarding`. Useful for users who later decide to move their vault into a Dropbox/iCloud folder. **Pre-confirm:** "Switching vaults — the new folder must contain a `cards/` directory. Mnemo will not migrate your existing cards." (We don't migrate. Users move files themselves.)

**Visual design.** Defer to the designer agent (small targeted ask — wireframe + Tailwind classes for the single onboarding screen). It must match the existing dark/light theme and not require new icons.

**Alternatives considered.**
- *Picker as a modal on first launch instead of a route* — rejected: a route survives navigation, supports back/forward, is reachable from settings, is testable as a first-class screen.
- *Auto-create `~/Documents/mnemo` and skip the picker* — rejected: that's exactly today's failure mode (VC-2 fails). The product's pitch is "you own the folder"; not asking is anti-product.
- *Separate "create new vault" vs "open existing vault" actions* — overkill for v1. The picker handles both: if the chosen folder has a `cards/` subdir, the index discovers existing cards; if not, both subdirs are created empty.

**Consequences.** v1 ships with a real first-run experience. The diff is small (one route, two IPC handlers, one config field). VC-2 is satisfied. The pre-mortem risk is closed.

---

### ADR-009: Native Application Menu — Standard Mac Menu Mandatory; Off on Windows / Linux  `[New design]`

**Status:** Accepted. To implement.

**Context.** Today, `setApplicationMenu` is never called. On macOS, that means the menu bar shows the binary name (`electron` in dev, `Mnemo` in production) with only the default Help / Window items — no About, no Quit (Cmd-Q still works via the OS), no Preferences, no standard Edit menu (which costs us copy/paste/select-all/undo/redo accelerators in non-input contexts). On Windows / Linux, no menu means no in-window menu bar — which is *fine*, the app's UI is keyboard-driven and self-contained.

**Decision.**

**macOS:** Ship a standard Cocoa app menu via `Menu.buildFromTemplate(...)` + `Menu.setApplicationMenu(...)` at `app.whenReady()`. Use `role:` strings for stock items so accelerators and behavior are platform-correct.

Menu structure:

- **Mnemo** — `About Mnemo` (role: `about`), separator, `Preferences…` (Cmd-,, custom — sends `menu:open-settings` to renderer), separator, `Services` (role: `services`), separator, `Hide Mnemo` (role: `hide`), `Hide Others` (role: `hideOthers`), `Show All` (role: `unhide`), separator, `Quit Mnemo` (role: `quit`).
- **File** — `New Card` (Cmd-N, sends `menu:new-card`), `Open Vault Folder…` (custom, opens a folder picker and triggers re-onboarding), separator, `Import…` (sends `menu:import`), `Export Selected…` (sends `menu:export` — disabled when no selection), separator, `Close Window` (role: `close`).
- **Edit** — `Undo` / `Redo` / `Cut` / `Copy` / `Paste` / `Select All` / `Find` (all `role:` defaults). `Find` sends `menu:find` to the renderer for the search bar focus.
- **View** — `Review` (Cmd-1), `Browse` (Cmd-2), `Dashboard` (Cmd-3), `Settings` (Cmd-,), separator, `Toggle Theme` (Cmd-Shift-T), separator, `Reload` (role: `reload` — dev only), `Toggle Developer Tools` (role: `toggleDevTools` — dev only), separator, `Toggle Full Screen` (role: `togglefullscreen`).
- **Window** — `Minimize` (role: `minimize`), `Zoom` (role: `zoom`), separator, `Bring All to Front` (role: `front`).
- **Help** — `Mnemo on GitHub` (custom, calls `shell.openExternal('https://github.com/yarikleto/mnemo')`), `Report an Issue…` (calls `shell.openExternal('https://github.com/yarikleto/mnemo/issues/new')`).

**Menu → renderer dispatch.** Custom menu items send a `menu:<verb>` channel via `webContents.send`. The renderer subscribes via a single `onMenuCommand(cb)` listener exposed in preload (additive to `Api`). The `GlobalShortcuts` component in `src/renderer/app.tsx` is **kept** for the existing in-renderer shortcuts (Cmd-N, Cmd-,) — but the menu items take precedence on macOS because they bind the system accelerator at the OS level.

**Windows / Linux:** **No menu**. `Menu.setApplicationMenu(null)` is called explicitly to suppress the default Edit/View menu Electron auto-installs on these platforms (it's awkward — it shows in the window chrome and duplicates the renderer's UI). The renderer-side `GlobalShortcuts` keeps Cmd/Ctrl-N and Cmd/Ctrl-, working. Future v2 tray work would add a system tray menu — *not* a window menu.

**Alternatives considered.**
- *Cross-platform menu* — rejected. On Windows the in-window menu bar duplicates the sidebar / route picker UI. The friction of building a unified menu that's idiomatic on all three OSes is real, and the user research signal is "macOS is primary."
- *Custom title bar with embedded menu* — overkill for v1.
- *Skip the macOS menu entirely* — rejected. Users *will* notice the missing About / Preferences / Hide accelerators on a Mac. It's a 1-star "feels unfinished" signal.

**Consequences.** macOS users get Cmd-,, Cmd-Q, Cmd-H, Cmd-W idiomatically. Windows / Linux users get a clean window-only experience matching their OS conventions. Implementation is ~80 LOC in a new `src/main/menu.ts` module.

---

### ADR-010: Window-State Persistence — Bounds + Display + (No) Fullscreen, with Multi-Monitor Fallback  `[New design]`

**Status:** Accepted. To implement.

**Context.** `src/main/index.ts` currently constructs the `BrowserWindow` with `width: 1280, height: 800, fullscreen: true` and never persists state. Every launch reopens fullscreen on the primary display, regardless of where the user last had the window or whether they prefer windowed. VC-4 ("closing and reopening preserves the vault selection and the last visited route, on the same display") fails on the display-tracking half.

**Decision.** Persist window state to `userData/window-state.json` (separate file from `config.json` to avoid schema thrashing on every move/resize).

**Persisted shape:**

```ts
type WindowState = {
  bounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  fullscreen: boolean
  displayId: number  // matches Electron Display.id
}
```

**Restore algorithm:**

1. On `app.whenReady`, read `window-state.json`. If absent or invalid, fall back to defaults: `width: 1280, height: 800`, centered on the primary display, **`fullscreen: false`** (the current `fullscreen: true` is reverted — fullscreen-by-default is a power-user surprise; the user can always Cmd-Ctrl-F).
2. On restore, call `screen.getAllDisplays()` and find the display whose `id` matches the persisted `displayId`. If no match (monitor disconnected, lid closed, dock change), fall back to `screen.getPrimaryDisplay()` and clamp the bounds inside its `workArea`.
3. Even if the display matches, clamp `bounds` against the chosen display's `workArea` (a window restored from a 4K display onto a 1080p one would otherwise spawn off-screen).
4. Apply `bounds`, then `if (state.maximized) win.maximize(); else if (state.fullscreen) win.setFullScreen(true);`. Maximized takes precedence (rare both-true edge case from racy save).

**Save algorithm:**

- Listen for `move`, `resize`, `maximize`, `unmaximize`, `enter-full-screen`, `leave-full-screen` events.
- Debounce by 500 ms (writing on every pixel of a drag is wasteful).
- On `before-quit`, do a final synchronous write so a quit during a drag doesn't lose the latest position.
- Never save bounds while maximized/fullscreen — capture the last *normal* `getNormalBounds()` instead. This is the standard trick for restoring "the size the user actually picked" after un-maximizing.

**Coexistence with vault path + last route.** VC-4 binds three things: vault selection (already persisted in `config.json`), last visited route, and display. The route belongs to the renderer's UI state, not main's window state — extend `useAppStore` with a `lastRoute` field persisted via `window.api.updateConfig` (one extra optional field on `Config`). On `init()`, after navigating to `/review` (or `/onboarding`), check `lastRoute` and replace if set.

**Alternatives considered.**
- *Use the `electron-window-state` package* — viable but unmaintained (last release 2018). The full implementation is ~60 LOC; ship our own.
- *Persist bounds in `config.json`* — rejected: window state changes far more often than config; mixing them risks corrupting config on concurrent writes.

**Consequences.** v1 launches windowed (not fullscreen) by default. Subsequent launches restore exactly where the user left it. Multi-monitor disconnect is graceful. VC-4 is satisfied.

---

### ADR-011: CI Matrix — GitHub Actions, Build-on-Tag, Sign + Notarize on macOS, Publish to Releases  `[New design]`

**Status:** Accepted. To implement.

**Context.** No CI today. Every build is `npm run dist:*` on the maintainer's MacBook, which means: (a) the Linux and Windows artifacts are emulated/cross-built locally and barely tested, (b) signing creds live on a single laptop, (c) there's no consistent release rhythm, (d) the round-trip auto-update rehearsal (TVC-F1) is impossible without reproducible signed artifacts.

**Decision.** A single GitHub Actions workflow at `.github/workflows/release.yml` that triggers on tag push (`v*`), builds the platform matrix in parallel, signs + notarizes on macOS, and publishes the lot to GitHub Releases as a draft for the maintainer to publish manually.

**Runner matrix:**

| Runner | Target | Sign | Notarize | Publish |
|---|---|---|---|---|
| `macos-14` (arm64) | Universal DMG + ZIP | yes | yes | yes |
| `windows-latest` | NSIS `.exe` | no (v1) | n/a | yes |
| `ubuntu-24.04` | AppImage + `.deb` | n/a | n/a | yes |

`macos-13` (x64) is **not** needed — `macos-14` builds a universal binary that runs on both arches. (Verified at v1; if the universal-from-arm64 build path ever has a regression, fall back to a separate `macos-13` runner.)

**Workflow shape (high level — devops agent owns the YAML):**

1. `on: push: tags: ['v*']` + `workflow_dispatch` for manual triggering.
2. Job `build` with the runner matrix above. Per job:
   - Checkout, `actions/setup-node@v4` with Node 20 LTS.
   - `npm ci` (NOT `npm install` — lockfile-only install).
   - `npm run typecheck && npm run test && npm run build`.
   - Per-OS step: `npm run dist:mac | dist:win | dist:linux` with `--publish always` so electron-builder does the GitHub upload.
3. Secrets exposed only to the `macos-14` job (`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). `GH_TOKEN` is `${{ secrets.GITHUB_TOKEN }}` for all jobs.
4. The release is created as a *draft*. Maintainer reviews artifacts (download + smoke test on a fresh Mac) before flipping to "Published" — that's the moment auto-update sees the new version.

**Pre-release CI (a second workflow at `.github/workflows/ci.yml`):**

- On every push and PR (today the project pushes directly to `main` per `CLAUDE.md` — but a CI pass on `main` is still valuable as a failure tripwire): `npm ci && npm run typecheck && npm run test`.
- This is **not** a release pipeline. It's the "did we break the build" check that gates the maintainer from cutting a tag against a broken `main`.

**Secret management.** All six release secrets live as GitHub repository secrets. Rotation cadence: Apple cert renews annually (calendar reminder); `APPLE_APP_SPECIFIC_PASSWORD` rotates if leaked. None of these secrets should ever be echoed by the workflow (mask is automatic, but `set -x` is forbidden).

**Cache.** `actions/cache` for `~/.npm`, keyed on `package-lock.json`. ~30 seconds per job on warm cache.

**Alternatives considered.**
- *Single-runner release on macOS only with cross-builds* — rejected: Wine on macOS for Windows builds is unreliable, and nested electron-builder invocations cross-OS are fragile.
- *GitLab / CircleCI / Jenkins* — rejected: GitHub Actions is free for public repos and the artifacts publish to the same repo's releases natively.

**Consequences.** Every tag push produces signed Mac + unsigned Windows/Linux artifacts in a draft GitHub Release. The maintainer can rehearse v0.0.1 → v0.0.2 (TVC-F1) trivially. Solo-maintainer pipeline: reproducible, reviewable, no "it builds on my machine" drift.

---

### ADR-012: `@electron/fuses` — Lock the Runtime Surface  `[New design]`

**Status:** Accepted. To implement.

**Context.** Electron Fuses (set at package-time, before signing) flip compile-time-equivalent settings on the packaged binary. They harden the runtime against `ELECTRON_RUN_AS_NODE` exploits, ASAR tampering, and `--inspect`-flag debugging. There is currently no `fuses.ts` in the codebase and no `afterPack` hook in `electron-builder.yml`.

**Decision.** Add `@electron/fuses` as a devDependency and run it as an `afterPack` electron-builder hook. The fuses are flipped on every binary in the unpacked app bundle before signing.

**Fuse table:**

| Fuse | Value | Why |
|---|---|---|
| `RunAsNode` | `false` | Disables `ELECTRON_RUN_AS_NODE` env var. A signed Mnemo binary cannot be hijacked into running arbitrary Node code. |
| `EnableNodeOptionsEnvironmentVariable` | `false` | `NODE_OPTIONS=--require=/path/to/evil.js` no longer works against our signed binary. |
| `EnableNodeCliInspectArguments` | `false` | `--inspect` / `--inspect-brk` / `--remote-debugging-port` are blocked. No production debugger attach. |
| `EnableCookieEncryption` | `true` | The Chromium cookie store on disk is encrypted via OS keychain. Mnemo doesn't use cookies today, but harmless to enable. |
| `EnableEmbeddedAsarIntegrityValidation` | `true` | Pairs with `OnlyLoadAppFromAsar`. Validates the embedded ASAR header SHA on every load. |
| `OnlyLoadAppFromAsar` | `true` | Refuses to load an unpacked `app/` folder if the ASAR is missing. Defeats "swap a JS file in the app bundle" attacks. |
| `LoadBrowserProcessSpecificV8Snapshot` | `false` | We don't ship a custom V8 snapshot. (Default is false; we set explicitly for clarity.) |
| `GrantFileProtocolExtraPrivileges` | `false` | `file://` does NOT get extra privileges. Defense for our `mnemo-asset://` boundary. |

**Implementation sketch (devops to ship):**

- `npm install --save-dev @electron/fuses`.
- `electron-builder.yml` gains `afterPack: build/fuses.cjs`.
- `build/fuses.cjs` calls `flipFuses(appPath, { version: FuseVersion.V1, [FuseV1Options.RunAsNode]: false, ... })` — synchronous Node script, runs once per platform per build.

**ASAR integrity caveat.** `EnableEmbeddedAsarIntegrityValidation` works on macOS and Windows (Electron 30+). On Linux it's a no-op (ASAR integrity isn't enforced). That's fine for v1 — Linux is best-effort and unsigned anyway.

**Alternatives considered.**
- *Skip fuses* — rejected: leaves the `ELECTRON_RUN_AS_NODE` and `--inspect` attack surfaces wide open on the signed binary. Cheap to enable.
- *Wait for `@electron-forge/plugin-fuses`* — irrelevant, we're on electron-builder.

**Consequences.** Signed Mac binary cannot be repurposed as a Node interpreter. Tampering with the ASAR triggers a signature mismatch and refuses to load. This is the canonical desktop-Electron hardening, free.

---

### ADR-013: Single-Instance Lock — `app.requestSingleInstanceLock()`  `[New design]`

**Status:** Accepted. To implement.

**Context.** Today, double-clicking the Mnemo app icon (or launching from Spotlight while Mnemo is already running) on Windows / Linux silently spawns a second process. Two processes contending on the same vault is a corruption hazard: both have a chokidar watcher that fires on the other's writes, both have a `CardIndex` that diverges, and atomic writes don't help because `state/<id>.json` could be racing on the same key from two scheduler instances. macOS happens to dodge this because of the OS app-singleton model, but we don't get to rely on that for cross-platform shipping.

**Decision.** At the very top of `src/main/index.ts`, before `app.whenReady()`:

```
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _cwd) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

(Pseudocode — developer agent writes the actual code; the `mainWindow` reference must be promoted to module scope.)

**Future deep-link plumbing.** When v2 adds `setAsDefaultProtocolClient('mnemo')` for `mnemo://` URLs or `.mnemo.zip` file association, the `second-instance` handler is where the existing process picks up the new launch's `argv` and routes to import. Wiring it now (even with no protocol/association at v1) keeps the code-path correct.

**Alternatives considered.**
- *Skip on macOS only* — rejected. The lock is harmless on macOS (always succeeds) and adding it cross-platform avoids an `if (process.platform !== 'darwin')` smell.
- *Detect via PID file in `userData/`* — rejected. `requestSingleInstanceLock` is the official, cross-platform, race-free primitive; reinvention is anti-Boring-Technology.

**Consequences.** One Mnemo instance per user. Vault corruption from concurrent processes is impossible. Future deep-link handling slots in.

---

### ADR-014: Logging + Crash Reporting (Minimal at v1)  `[New design — minimum viable]`

**Status:** Accepted. To implement (minimum viable).

**Context.** The pre-mortem ranks "auto-update breaks silently" as risk #2. Without logs from the running app, debugging a stuck-on-old-version user requires guessing. A minimal observability story prevents that.

**Decision.** Ship two minimal pieces at v1; defer Sentry / proper crash reporting to v1.x.

1. **Structured file logging in main.** Add `electron-log` (`^5.x`). Configure in `src/main/index.ts`:
   - `log.transports.file.resolvePathFn` → `path.join(app.getPath('userData'), 'logs', 'main.log')`.
   - `log.transports.file.maxSize` → 1 MB; rotate to `main.old.log`.
   - `log.transports.console.level` in dev only.
   - All `console.log` / `console.error` in main is replaced with `log.info` / `log.error`. (One-time sweep; not a big diff.)
   - `autoUpdater.logger = log` (ADR-006).
2. **Crash reporter — disk-only at v1.** `crashReporter.start({ uploadToServer: false, submitURL: '' })`. Native crashes go to `userData/Crashpad/`. **No remote upload**. The user can attach the dump to a GitHub issue manually.
3. **"Copy diagnostics" menu item.** Add to Help menu (ADR-009): copies app version + OS + last 50 log lines to the clipboard. Single-click support gold.

**Telemetry: zero, ever.** The vision says so loudly. No analytics, no error pings, no "was this update successful" beacon. The product is local-first; observability is local-first too.

**Future (v1.x):** Sentry's Electron SDK in opt-in mode, gated by a settings toggle that defaults OFF. Captures main + renderer + native crashes. Only ship when there are enough users that issue triage is a real time sink.

**Consequences.** Free, local-only diagnostics. The maintainer (and motivated users) can dig into a stuck-state bug. No privacy trade-off.

---

## 5. Content Security Policy (Recap & Recommended Tightening)

The current CSP (already shipping):

```
default-src 'self' mnemo-asset:;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' mnemo-asset: data: blob:;
font-src 'self' data:;
connect-src 'self' ws: wss:;
object-src 'none';
base-uri 'none';
frame-src 'none';
```

This is correct and was the focus of the recent `f307ba5` and `a91fe40` PRs. **No tightening required at v1.** Two notes:

- `'wasm-unsafe-eval'` is required by Shiki and intentionally does NOT enable JavaScript `eval`. Keep it; document why in the CSP comment block in `src/main/index.ts` (already done).
- `connect-src 'self' ws: wss:` includes `ws:` and `wss:` for Vite HMR (`@vitejs/plugin-react` and HMR socket). This is set even in production but is harmless because (a) `webSecurity: true` plus the origin model makes a renderer `WebSocket` to an arbitrary host an unusual ask, and (b) production has no HMR server to connect to. Could be tightened to omit `ws:` / `wss:` in packaged builds — small win, deferred to v1.x.

The `connect-src` allowlist for the auto-updater feed is **not** needed because `electron-updater` runs in main, not renderer — its HTTPS calls are not subject to renderer CSP.

---

## 6. Fuses Table (Recap)

(See ADR-012 for the full table.) Final list:

```
RunAsNode                              = false
EnableNodeOptionsEnvironmentVariable   = false
EnableNodeCliInspectArguments          = false
EnableCookieEncryption                 = true
EnableEmbeddedAsarIntegrityValidation  = true
OnlyLoadAppFromAsar                    = true
LoadBrowserProcessSpecificV8Snapshot   = false
GrantFileProtocolExtraPrivileges       = false
```

---

## 7. Technical Verification Criteria (TVCs)

Each TVC is observable by a developer or tooling. Each traces to one or more product VCs from `.claude/product-vision.md`.

### A. Code-signing + notarization (→ VC-1)

- **TVC-A1.** `codesign -dv --verbose=4 /Applications/Mnemo.app` reports `Authority=Developer ID Application: <Org Name> (<TEAMID>)`, `Authority=Developer ID Certification Authority`, `Authority=Apple Root CA`. Trace: VC-1.
- **TVC-A2.** `spctl --assess --type execute --verbose=4 /Applications/Mnemo.app` reports `accepted` and `source=Notarized Developer ID`. Trace: VC-1.
- **TVC-A3.** `xcrun stapler validate /path/to/Mnemo-X.Y.Z-universal.dmg` reports `The validate action worked!`. Trace: VC-1 (offline-Gatekeeper success).
- **TVC-A4.** Fuses verified by `npx @electron/fuses read /Applications/Mnemo.app/Contents/MacOS/Mnemo` matches the table in ADR-012. Trace: VC-1 (no scary warnings) + defense-in-depth.

### B. First-run onboarding (→ VC-2)

- **TVC-B1.** On a Mac with no `~/Library/Application Support/Mnemo/` directory, launching the app navigates to `/onboarding` (verified by Playwright e2e). Trace: VC-2.
- **TVC-B2.** Clicking "Use the default" on the onboarding screen creates `~/Documents/mnemo/cards/` and `~/Documents/mnemo/state/` and lands on `/review` with an empty queue. Trace: VC-2.
- **TVC-B3.** Clicking "Choose a folder…" opens an OS folder picker and, on selection, completes onboarding against the chosen path. Trace: VC-2.
- **TVC-B4.** `getConfig` returns `onboardedAt: <ISO timestamp>` after onboarding. Trace: VC-2.

### C. Live external-editor sync (→ VC-3, VC-7)

- **TVC-C1.** Existing chokidar `Watcher` test suite continues to pass. Trace: VC-3.
- **TVC-C2.** A Playwright e2e that (a) starts the app, (b) writes a new card via `fs.writeFile` directly into the vault, (c) asserts the renderer's browse list updates within 1500 ms (chokidar debounce + IPC + render). Trace: VC-3.
- **TVC-C3.** No file in `cards/` is opaque or binary; `file cards/**/*` returns `text/plain` or `text/markdown` for every entry. (Optional CI lint.) Trace: VC-7.

### D. Window-state persistence (→ VC-4)

- **TVC-D1.** Resize the window to 900×700, quit, relaunch. Window restores at exactly 900×700 on the same display. Trace: VC-4.
- **TVC-D2.** Disconnect the secondary monitor where the window last lived; relaunch. Window restores on the primary monitor, clamped to its `workArea`. Trace: VC-4 (graceful degradation).
- **TVC-D3.** Last visited route persists: visit `/dashboard`, quit, relaunch — app navigates to `/dashboard` after `init()`. Trace: VC-4.

### E. Auto-update (→ VC-5)

- **TVC-E1.** On a packaged build with `app.isPackaged === true`, `autoUpdater.checkForUpdates()` is called within 60 seconds of `whenReady`. Trace: VC-5.
- **TVC-E2.** Round-trip rehearsal: install v0.0.1 (signed, notarized) on a fresh Mac, push v0.0.2 to GitHub Releases, leave v0.0.1 running for 30 minutes; renderer receives `update:ready` push. Trace: VC-5.
- **TVC-E3.** After the user clicks "Restart to update," next launch reports `app.getVersion() === '0.0.2'`. Trace: VC-5.
- **TVC-E4.** `electron-updater` log shows `verifyUpdateCodeSignature` ran and matched. Trace: VC-1 + VC-5 (no RCE via spoofed update).

### F. Offline (→ VC-6)

- **TVC-F1.** With network disabled (airplane mode or `pfctl` block on macOS), launch the app. `whenReady` succeeds, the window opens, the review queue loads, rating a card works. The auto-updater logs `net::ERR_INTERNET_DISCONNECTED` and silently retries on next interval. No UI block, no error modal. Trace: VC-6.

### G. Vault portability (→ VC-7, VC-8)

- **TVC-G1.** `git init` in the vault, `git add cards/`, `git commit`. The diff is human-readable. Trace: VC-7.
- **TVC-G2.** Existing archive export/import e2e continues to pass (already covered by Vitest suites; verify they also cover an asset-bearing card round-trip). Trace: VC-8.

### H. Single-instance + IPC integrity (→ defense-in-depth, supports VC-3, VC-7)

- **TVC-H1.** Launching a second Mnemo instance while one runs: the second exits within 200 ms; the first focuses. (Manual QA; or Playwright with `electron.launch` × 2.)
- **TVC-H2.** All 21 (+2 new from ADR-008) IPC handlers are registered through `h(...)`. Static check: `grep -rn "ipcMain.handle\b" src/main` returns only the line inside `register.ts` that defines `h`. Trace: defense-in-depth.

---

## 8. Risks (Top 3)

### Risk 1: Apple Developer enrollment slips, blocking macOS sign + notarize.
- **Likelihood:** Medium. A 2-day chore that nobody likes; bureaucratic wait time outside our control.
- **Impact:** High. Without it, VC-1 fails; pre-mortem #1 materializes.
- **Mitigation:** This is the *very first* devops action — start the enrollment paperwork before any other v1 work. Track in CEO brain. While waiting, devops can stand up the GitHub Actions workflow with stub creds and the unsigned Linux/Windows pipelines, so the moment the cert lands, all that's left is plugging in secrets and re-running.

### Risk 2: Auto-update round-trip fails silently on first real release.
- **Likelihood:** Medium. `electron-updater` is well-trodden, but every project's first release-day rehearsal surfaces *something* (signing scope mismatch, `latest.yml` URL mismatch, channel name typo).
- **Impact:** Catastrophic. Users get stranded on v1.0.0 forever; the only fix is asking them to manually re-download, which they won't see.
- **Mitigation:** TVC-E2 (the v0.0.1 → v0.0.2 round-trip) is a **release gate** for v1.0.0. Do not tag v1.0.0 until the round-trip works on a real packaged build on a real fresh Mac. Manual-QA agent runs this test; it cannot be skipped.

### Risk 3: Introducing the onboarding route + window-state changes regresses the existing renderer init flow.
- **Likelihood:** Low to medium. Both changes touch the boot path (`useAppStore.init`, the `BrowserWindow` constructor, the route guard).
- **Impact:** Medium. A regression that breaks `/review` for existing users on upgrade is a 1-star event.
- **Mitigation:** (a) `onboardedAt: null` default plus a backward-compat path in `useAppStore.init`: if `onboardedAt == null` AND `rootPath` points to a real directory containing `cards/`, treat the existing user as onboarded and *write* the timestamp without surfacing the route. This means existing daily-driving users (the maintainer themselves) skip the onboarding screen on the first v1 launch. (b) The window-state file is missing on first v1 launch, which falls back to the safe default — explicitly *not* fullscreen. Test both cases via Playwright e2e on a clean `userData/` and on a populated one before tagging.

---

## 9. Out of Scope (Explicitly Deferred)

These are real future decisions but *not* v1 problems. Listing here so future contributors don't accidentally treat them as gaps in this design:

- **Tray + due-card notifications** (vision §"App Lifecycle Mode") — v2.
- **Multi-vault support** — v2 / v3.
- **Anki `.apkg` importer** — out of scope; possibly external tool.
- **Plugin system** — likely never.
- **Sync infrastructure** — never (vision §"What This Is NOT").
- **Mobile companion** — separate product if it exists.
- **Windows code-signing (Azure Trusted Signing)** — fast-follow after v1, when Windows audience materializes.
- **SQLite migration of vault** — explicitly forbidden (ADR-004).
- **Sentry / remote crash reporting** — v1.x; v1 is local-only logs (ADR-014).
- **`app://` custom protocol for the renderer shell** — small future hardening, marginal at v1 (ADR-003).

---

## 10. Next Agents to Dispatch

In execution order:

1. **Architect (self) — `/common-electron-app-architect-tasks`.** Once this design is approved, break the new-design ADRs (006, 007, 008, 009, 010, 011, 012, 013, 014) into discrete developer + devops tasks with dependencies. The "documenting existing decision" ADRs (001–005) generate **no** tasks — they're reference only.
2. **DevOps — `/common-electron-app-devops-package`.** Owns ADRs 007 (signing + notarization), 011 (CI matrix), 012 (fuses), 006 (auto-update wiring on the build/publish side), 014 (logging plumbing). Will produce client handoff guides for: Apple Developer enrollment, GitHub secret management, the v0.0.1 → v0.0.2 rehearsal protocol, the future Windows signing fast-follow.
3. **Designer — small targeted asks (NOT full design-spec extraction).** Two asks:
   - Onboarding screen wireframe + Tailwind spec (ADR-008). Single screen, two buttons, matches existing dark/light theme, no new icons.
   - macOS native menu map (ADR-009). The verbatim menu structure is in ADR-009; designer just confirms the labels and accelerator picks fit Mnemo's voice. No mock needed unless they spot a clash.
4. **Developer — implementation of ADRs 006 (renderer-side updater UX), 008 (onboarding route + new IPCs), 009 (menu → renderer dispatch on the renderer side), 010 (window-state on the main side + `lastRoute` on the renderer side), 013 (single-instance lock).** Task list comes from step 1.
5. **Tester — Vitest + Playwright suites for new flows.** Onboarding e2e, window-restore e2e, auto-update mock e2e (the real round-trip is manual).
6. **Manual-QA — owns the v0.0.1 → v0.0.2 release-day rehearsal (TVC-E2), the fresh-Mac VC-1 walkthrough, the multi-monitor disconnect test (TVC-D2).**

**Data agent — NOT NEEDED for v1.** The persistence tier is file-based markdown vault + JSON state (ADR-004), not SQL. The data agent's default tooling (better-sqlite3 + Drizzle) does not apply. There is no schema-design or migration work in scope. If a future feature *does* need relational data (e.g., a per-card review-history aggregate cached for the dashboard), revisit then; the cost of a SQLite cache *next to* the markdown vault is fine — the cost of replacing the vault with SQLite is a product break.
