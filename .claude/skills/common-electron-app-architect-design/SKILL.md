---
name: common-electron-app-architect-design
description: Architect produces a full Electron-app system design from the approved product vision and prototype (the **Plan** phase of the spec-driven loop) — ADRs (process model, IPC contracts, security posture, builder choice, auto-update strategy, native-module policy, persistence tier, multi-window architecture), C4 context/container diagrams, IPC contract sketches with zod, fuses table, CSP, packaging strategy, and technical verification criteria that bind back to the vision's product criteria. Use after product vision and prototype are approved.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent, mcp__claude_ai_Excalidraw__read_me, mcp__claude_ai_Excalidraw__create_view, mcp__claude_ai_Excalidraw__export_to_excalidraw
argument-hint: "[--update to revise existing design]"
---

# Architect Design — System Design from Vision + Prototype

You are the CEO. The product vision and prototype are approved. Now hand off to the **architect** to produce a full system design for the desktop Electron application.

## Step 1: Verify inputs exist

Check that these files exist:
- `.claude/product-vision.md` — the product vision
- `.claude/prototypes/` — at least one prototype version
- `.claude/design-spec.md` — design tokens and screen map (preferred — has menu map / shortcut map references)
- `.claude/ceo-brain.md` — CEO knowledge base

If any are missing, tell the user what's needed and suggest running `/common-electron-app-init` first.

If `$ARGUMENTS` contains `--update`, read the existing `.claude/system-design.md` — architect will revise, not start from scratch.

## Step 2: Brief the architect

Send **architect** with this brief:

> Read these files carefully:
> - `.claude/product-vision.md` — what we're building, target platforms, distribution channels, auto-update strategy, app lifecycle mode (foreground vs background-resident), window architecture flag
> - `.claude/prototypes/README.md` — index of prototypes; find the latest approved version
> - The latest prototype HTML file — understand screens, flows, menu locations, accelerator hints
> - `.claude/design-spec.md` — design tokens and screen map
> - `.claude/menu-map.md` — per-platform menu structure
> - `.claude/shortcut-map.md` — accelerator inventory (informs IPC + global-shortcut decisions)
> - `.claude/ceo-brain.md` — strategic context, constraints, risks
>
> From this, produce a full system design document. Save it as `.claude/system-design.md`.
>
> The document MUST follow this structure:
>
> ```markdown
> # System Design
> > Version {N} — {date}
>
> ## 1. Overview
> <!-- One paragraph: what this desktop app does, in technical terms.
>      Reference the product vision for the "why." -->
>
> ## 2. Architecture Decision Records
>
> ### ADR-1: Process Model
> **Status:** Accepted
> **Context:** Electron has main (Node + full privilege), renderer (Chromium, untrusted), preload (sandboxed bridge), and optional utility processes. Picking the topology early affects security, performance, and packaging.
> **Decision:**
> - Main: {what runs here — DB, file IO, native menus, IPC handlers, auto-update}
> - Renderer: {one window / SDI / tabbed / multi-window — and which framework: React / Vue / Svelte / Solid}
> - Preload: {typed contextBridge wrappers — never raw ipcRenderer}
> - Utility processes: {none / one for {heavy work — PDF rendering, video decode, ML inference}}
> **Alternatives Considered:**
> - {Option} — rejected because {trade-off}
> **Consequences:** {crash-isolation gain, IPC overhead, packaging implications}
>
> ### ADR-2: IPC Contracts
> **Status:** Accepted
> **Context:** Every IPC channel is an attack surface and a coupling point. Without contracts, renderer can call anything; with raw `ipcRenderer` exposure, the sandbox is moot.
> **Decision:**
> - Channel naming: namespaced verbs — `docs:save`, `docs:load`, `prefs:read`, `prefs:write`, `windows:open-file`
> - Validation: every payload validated with **zod** at the `ipcMain.handle` boundary; preload wrapper also validates outgoing args
> - Origin check: every handler validates `event.senderFrame.url` against an allowlist
> - Bridge: `contextBridge.exposeInMainWorld('api', { saveDoc: (doc) => ipcRenderer.invoke('docs:save', doc) })` — typed wrappers only
> - Errors: structured `{ ok: false, code, message }` returns; never throw across IPC
> **Initial channel inventory:** {list — docs:*, prefs:*, windows:*, updater:*, dialog:*}
> **Consequences:** Type-safe surfaces, contract-testable, but every new feature requires a channel design step.
>
> ### ADR-3: Security Posture
> **Status:** Accepted
> **Context:** Defense-in-depth: contextIsolation + sandbox + CSP + fuses + ASAR integrity. Partial defense is no defense.
> **Decision:**
> - `webPreferences` (red lines — reviewer blocks on sight):
>   `{ contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false, experimentalFeatures: false }`
> - CSP (renderer): `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' {api allowlist}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
> - App shell: served via `protocol.handle('app', …)` (Electron 25+) — NOT `file://`
> - Navigation: `will-navigate` denies all by default; `setWindowOpenHandler` returns `{ action: 'deny' }` by default
> - `shell.openExternal` wrapped — `new URL()` parse + scheme allowlist (`https:` / `mailto:`)
> - `@electron/fuses` (set at package time, before signing):
>   - `RunAsNode: false`
>   - `EnableNodeOptionsEnvironmentVariable: false`
>   - `EnableNodeCliInspectArguments: false`
>   - `EnableCookieEncryption: true`
>   - `EnableEmbeddedAsarIntegrityValidation: true` + `OnlyLoadAppFromAsar: true` (paired)
>   - `LoadBrowserProcessSpecificV8Snapshot: true`
>   - `GrantFileProtocolExtraPrivileges: false`
> - Single-instance lock: `app.requestSingleInstanceLock()` + `second-instance` handler
> - `enableRemoteModule` / `@electron/remote` — never (removed in Electron 14)
> **Consequences:** Slightly more friction for developers (no raw Node in renderer) in exchange for a defensible posture.
>
> ### ADR-4: Builder & Packaging Strategy
> **Status:** Accepted
> **Context:** Forge 7.x (first-party, default) vs electron-builder (richer features for staged rollouts, deltas, exotic targets). Don't mix.
> **Decision:** {Forge 7.x | electron-builder} — {one-paragraph why for THIS project}
> **Initial targets:**
> - macOS: DMG (default ON), MAS (only if vision says so)
> - Windows: NSIS (default ON), MSI / MSIX (only if vision says so)
> - Linux: AppImage + deb (default ON), Snap / Flatpak (only if vision says so)
> **Architectures:** {macOS arm64 + x64 (universal from arm64) | Windows x64 + arm64 | Linux x64 + arm64}
> **Native modules:** `@electron/rebuild` (NOT deprecated `electron-rebuild`) per-arch in CI; pure-JS first → N-API prebuilt second → compile-from-source last.
> **Consequences:** {trade-offs — Forge gets new Electron features day one; electron-builder unlocks delta updates}
>
> ### ADR-5: Auto-Update
> **Status:** Accepted
> **Context:** Three options: electron-updater (channels, staged rollout, deltas), update.electronjs.org (free for OSS public GitHub repos), or none.
> **Decision:** {electron-updater ≥ 6.3.9 | update-electron-app + update.electronjs.org | none — and why}
> **Channels:** {stable / beta — separate `latest.yml` per channel}
> **Signature verification:** `verifyUpdateCodeSignature` — never disabled; `publisherName` matches cert CN.
> **Server:** {S3 + CloudFront | GitHub Releases | self-hosted bucket}
> **Consequences:** {staged rollout capability, delta size savings vs full installer, server cost}
>
> ### ADR-6: Persistence Tier
> **Status:** Accepted
> **Context:** Settings vs relational user data have different shapes. Coordinated with the `data` agent's schema work.
> **Decision:**
> - Settings: **electron-store** v10+ (ESM-only since v9) — window bounds, last-opened file, prefs. Hard cap ~tens of KB.
> - Relational user data: **better-sqlite3** v11+ with `PRAGMA journal_mode=WAL; synchronous=NORMAL; foreign_keys=ON; busy_timeout=5000` at open. ORM: **Drizzle** (over Prisma — no native query engine binary to ship).
> - Encryption: `safeStorage` (Keychain / DPAPI / libsecret) wraps a 32-byte random DB key, stored as wrapped blob in `userData`. For DB-at-rest add **better-sqlite3-multiple-ciphers** (SQLCipher).
> - File writes: `write-file-atomic`. File watches: `chokidar` (never raw `fs.watch`).
> - Filesystem layout: app DB / config under `app.getPath('userData')`. NEVER write inside the app bundle / install dir.
> **Consequences:** {trade-offs — sync better-sqlite3 needs care for big queries (utility process for >100ms work)}
>
> ### ADR-7: Native Menus & Window Architecture
> **Status:** Accepted
> **Decision:**
> - macOS: `Menu.setApplicationMenu` is mandatory (without it the OS shows the binary name). Stock items via `role:` strings.
> - Windows / Linux: in-window menu OR custom title bar with menu — pick one and justify.
> - Window architecture: {single window | SDI — one window per document | tabbed | multi-window with shared state}
> - Window state persistence: window bounds + maximized + display ID via electron-store; clamp restored window to a currently-visible display via `screen.getAllDisplays()`.
> **Consequences:** {one-line — drives developer task list and accelerator wiring}
>
> ### ADR-8: Deep Links & File Associations
> **Status:** Accepted
> **Decision:**
> - Custom protocol: `setAsDefaultProtocolClient('myapp')` + `second-instance` handler.
> - File associations: declared in `forge.config` / `electron-builder.json` `fileAssociations`.
> - macOS: `open-url` event (only fires when packaged — won't fire under `npm start`).
> - Windows / Linux: `process.argv` + `second-instance` handler.
> **Consequences:** Cold-start vs warm-start paths differ — manual-qa tests both.
>
> ### ADR-9+: {Other key decisions}
> <!-- Add ADRs for: telemetry / crash reporting (Sentry / Bugsnag),
>      logging (electron-log), tray vs no-tray (only for background-resident apps),
>      global shortcuts (only for media keys / launchers — almost always wrong otherwise),
>      offline strategy. Only Type 1 (irreversible) or high-impact decisions. -->
>
> ## 3. System Context (C4 Level 1)
> <!-- Create an Excalidraw diagram showing:
>      - The desktop app as a central box
>      - Users / personas around it
>      - External services (license server, auth provider, sync API, update server)
>      - The local OS (filesystem, Keychain/DPAPI, system tray, file associations)
>      - Arrows showing relationships -->
>
> ## 4. Container Diagram (C4 Level 2 — Process Model)
> <!-- The high-level technical building blocks INSIDE the app:
>      - Main process (Node)
>      - Renderer process(es) — one box per window type
>      - Preload script(s)
>      - Utility process(es) — if any
>      - Local SQLite DB
>      - electron-store JSON file
>      - safeStorage-wrapped key
>      Plus external:
>      - Update server (latest.yml endpoints per channel)
>      - Backend API (if any)
>      Show IPC channel boundaries explicitly. Excalidraw. -->
>
> ## 5. IPC Channel Map
> <!-- Every channel registered with `ipcMain.handle`. Group by namespace.
>
>      | Channel | Direction | Payload (zod sketch) | Returns | Origin allowlist |
>      |---------|-----------|---------------------|---------|------------------|
>      | `docs:save` | renderer → main | `{ id: string, body: string }` | `{ ok, public_id }` | app-protocol only |
>      | `docs:load` | renderer → main | `{ id: string }` | `{ ok, doc }` | app-protocol only |
>      | `prefs:read` | renderer → main | `{ key: string }` | `{ ok, value }` | app-protocol only |
>      | `windows:open-file` | renderer → main | `{}` | `{ ok, path? }` (uses `dialog.showOpenDialog`) | app-protocol only |
>      | `updater:check` | renderer → main | `{}` | `{ ok, status }` | app-protocol only |
>
>      For each channel: zod sketch (full schemas live in code), origin rule, error shape.
>      Push channels (main → renderer): `data:changed`, `updater:status`, etc. — list separately. -->
>
> ## 6. Data Model
> <!-- High-level entity sketch — the `data` agent owns the full schema.
>      For each entity: name, key fields, relationships.
>      Note which writes broadcast `data:changed` to all windows. -->
>
> ## 7. Component Breakdown (C4 Level 3)
> <!-- For each process (main / renderer / preload / utility), list major modules:
>      - Main: ipc-handlers/, db/, updater/, menus/, windows/, deep-links/
>      - Preload: api.ts (typed contextBridge surface), zod-schemas/
>      - Renderer: routes/, components/, state/, ipc-client/
>      - Utility (if any): {what runs here}
>      One sentence per module; key dependencies. -->
>
> ## 8. Key Technical Decisions
> <!-- Non-ADR-level decisions developers need to know:
>      - Renderer build tool (electron-vite is the boring default)
>      - State management (Zustand / Redux Toolkit / Pinia / Svelte stores)
>      - Validation library at IPC boundary (zod)
>      - Error handling strategy (structured IPC errors, user-facing toast vs dialog)
>      - Logging approach (electron-log, log file location in userData)
>      - Crash reporting (Sentry main + renderer + crashReporter)
>      - i18n (if relevant — i18next, locale files in resources/) -->
>
> ## 9. Performance Plan
> <!-- - Cold-start budget: window visible <500ms, interactive <1.5s. `ready-to-show` + `backgroundColor` to avoid white flash.
>      - Big SQLite queries: move to a utility process — never block the main process event loop.
>      - V8 snapshot for browser process (paired with `LoadBrowserProcessSpecificV8Snapshot` fuse).
>      - Renderer bundle size budget; lazy-load heavy routes.
>      - `app.contentTracing` for profiling main + renderer in regression cases. -->
>
> ## 10. Observability Plan
> <!-- - electron-log to file under userData; console mirror in dev only
>      - Sentry: main process + each renderer process + native crashes via crashReporter
>      - Crash dumps: enabled (`crashReporter.start({ uploadToServer: true, ... })`) — opt-in per privacy stance
>      - Update telemetry: log every check / download / apply / error to local log
>      - Optional product analytics (if vision asks for it) — opt-in only -->
>
> ## 11. Security Plan
> <!-- - Recap webPreferences red lines (ADR-3) — reviewer enforces
>      - IPC discipline: zod + senderFrame origin check on every handler
>      - CSP recap; custom protocol; deny navigation by default
>      - Fuses table (recap from ADR-3) — verified post-package via `npx @electron/fuses read --app <path>`
>      - ASAR integrity enabled; signed AFTER packaging
>      - Supply chain: `npm ci` (never `npm install`) in CI; lockfile committed; postinstall scripts audited; @electron/rebuild not electron-rebuild
>      - Secrets: never bundled into asar; safeStorage for anything that must persist with at-rest protection
>      - Single-instance lock; rate-limit `dialog.showOpenDialog` chains -->
>
> ## 12. Cross-Platform Considerations
> <!-- - Modifier keys: never hardcode `Ctrl+` — use `CmdOrCtrl`
>      - Menu locations: mac global vs Windows in-window vs GNOME header bar
>      - Window-control side: left mac, right Win/GNOME
>      - System fonts: -apple-system, Segoe UI Variable, Cantarell/Adwaita Sans
>      - Native scrollbars on macOS — never override
>      - HiDPI: 100/125/150/200%; per-monitor DPI mismatch handling
>      - `nativeTheme` `updated` event for dark / light flip mid-session -->
>
> ## 13. Verification Criteria
> <!-- The system design is the technical contract. List observable system-level
>      signals that prove the design serves the product vision's verification
>      criteria. Each technical criterion (TC) MUST trace back to one or more
>      product verification criteria (VC) from `.claude/product-vision.md`.
>
>      Format:
>      - TC-1 (verifies VC-1): {observable system behaviour, e.g. "First launch
>        on macOS opens a signed + notarized DMG → app starts → primary window
>        becomes visible within 500ms of `ready-to-show` event"}
>      - TC-2 (verifies VC-2): {e.g. "On second launch, window restores to last
>        bounds + display, clamped to currently-visible displays via
>        `screen.getAllDisplays()`"}
>      - TC-3 (verifies VC-3): {e.g. "Cmd+Q with unsaved work shows dialog;
>        choosing 'Save' persists via `docs:save` IPC and the data is readable
>        on restart"}
>      - TC-4 (verifies VC-4): {e.g. "electron-updater downloads update,
>        verifies signature with `verifyUpdateCodeSignature`, and installs on
>        next launch; force-quit during download leaves no orphan files"}
>      - TC-5 (cross-cutting security): {e.g. "Every `ipcMain.handle` validates
>        payload via zod and rejects unknown `event.senderFrame.url`"}
>      - TC-6 (cross-cutting fuses): {e.g. "Packaged app reports `RunAsNode:
>        false`, `EnableEmbeddedAsarIntegrityValidation: true`,
>        `OnlyLoadAppFromAsar: true` via `npx @electron/fuses read`"}
>
>      Aim for 6-15 criteria. Each is verifiable against a packaged build or
>      a Playwright `_electron` test. If you can't write a TC for an ADR, the
>      ADR may not be load-bearing — reconsider it. -->
>
> ## 14. Implementation Plan
> <!-- Ordered list of work packages — thin vertical slices.
>
>      ### Phase 1: Walking Skeleton — Foundation
>      The Electron walking skeleton is concrete:
>      1. Project scaffolding (Forge or electron-builder, electron-vite for renderer build) — S
>      2. Main process boots, primary window opens with secure webPreferences — S
>      3. Preload exposes one typed IPC: `health:ping` → returns `{ ok: true, version }` — S
>      4. Renderer calls `health:ping` and renders the version — S
>      5. Persistence: write a single value through `docs:save` to better-sqlite3 (or electron-store) and read it back on next launch — M
>      6. Packaging dry run: produce DMG + NSIS + AppImage; smoke-test the installers locally — M
>      7. Sign + notarize the macOS build; sign the Windows build; staple — M
>      8. Wire electron-updater (or update-electron-app) to a staging update channel and verify a real update lands — M
>      **Delivers:** a real signed installer that opens, persists data, and can self-update. This is the architecture proven in software, not in a doc.
>
>      ### Phase 2: {Core Feature Name} — Core Flow
>      1. ...
>      **Delivers:** {what the user can now do}
>
>      ### Phase 3+: ... -->
>
> ## 15. Open Questions
> <!-- Technical unknowns that need investigation before or during implementation.
>      E.g., "Confirm Windows ARM packaging via @electron/rebuild on
>      windows-11-arm runner — needs spike." -->
>
> ## 16. Risks
> <!-- Pre-mortem: what could go wrong technically?
>      Desktop-specific risks worth surfacing:
>      - Signing-cert provisioning gates the first installer (block on client action)
>      - Notarization rejects on a missing entitlement
>      - electron-updater downgraded by accident → CVE-2024-39698
>      - Native module won't build on Windows ARM
>      - safeStorage unavailable on Linux without libsecret
>      For each: likelihood, impact, mitigation. -->
> ```
>
> **Rules:**
> - Every tech choice must have a one-line "why." No unjustified decisions.
> - Default to boring technology — Forge 7.x, electron-vite, React or Vue, better-sqlite3, Drizzle, electron-updater. Use innovation tokens only where they create real value.
> - Start with the simplest architecture that works (Gall's Law). Note where it should evolve (e.g. "single window now; revisit tabbed if vision asks for >5 doc-types").
> - The implementation plan is in thin vertical slices — Phase 1 is the walking skeleton (real signed installer that self-updates).
> - Create Excalidraw diagrams for sections 3 and 4. Call `read_me` first.
> - Reference the product vision and prototype throughout — the design serves the product, not the other way around.
> - This is a **desktop Electron application**. If something in the vision implies pure web SaaS, mobile-native, embedded, blockchain, CLI, or generic library work, flag it instead of designing it.
> - `enableRemoteModule` / `@electron/remote` are removed in Electron 14 — never reference them.
> - `electron-rebuild` is deprecated — always specify `@electron/rebuild`.
> - electron-updater MUST be ≥ 6.3.9 (CVE-2024-39698 fix); `verifyUpdateCodeSignature` never disabled.

## Step 3: Review the design

When architect returns the document, read it yourself (as CEO). Check:
- Does the design serve the product vision? Or did the architect over-engineer (e.g. utility process for trivial work)?
- Are the ADRs justified? Or is this resume-driven development?
- Is the walking skeleton truly a SIGNED installer that self-updates? That's the bar.
- Are the security red lines explicit (webPreferences, fuses, CSP, custom protocol)?
- Does ADR-2 (IPC) actually validate every payload + every origin?
- Does ADR-5 (auto-update) pin electron-updater ≥ 6.3.9 and keep `verifyUpdateCodeSignature` ON?
- Is the implementation plan in achievable slices?
- Are there any risks the architect missed that you know about from the client conversation?

If something is off, send architect back with specific feedback.

## Step 4: Update the CEO brain

Once the design is approved, update `.claude/ceo-brain.md`:
- Update "Current State" — design approved, moving to packaging plan + data schema + test plan
- Update "Strategic Priorities" — first implementation phase (walking skeleton)
- Add to "Key Decisions Log" — design approved, key ADRs summarized
- Update "Architecture Overview" — one-paragraph summary (process model, IPC posture, builder, auto-update)

## Step 5: Update CLAUDE.md

Fill in the `TBD` sections in `CLAUDE.md` Project Context:
- **Overview** — from system design overview
- **Target Platforms** — from ADR-4 (targets + arches)
- **Tech Stack** — from ADRs (Electron version, builder, renderer framework, ORM, auto-update tool)
- **Project Structure** — main / renderer / preload directory layout
- **Commands** — fill what's known (`npm run dev`, `npm run package`, `npm run make`, `npm run publish`), leave rest TBD
- **Coding Conventions** — IPC channel naming (`ns:verb`), zod at the boundary, contextBridge typed wrappers

## Step 6: Present to the client

Give the client a brief executive summary:
- What process model was chosen (single window / SDI / tabbed) and why
- What builder (Forge / electron-builder) and why
- What auto-update strategy and why
- The walking skeleton — what it delivers (signed installer that self-updates)
- Timeline implication — how many phases, what each delivers
- Any open questions that need the client's input (especially signing-cert provisioning)

Ask: "This is the technical plan. Any concerns before we start building?"

Wait for approval before proceeding to implementation.
