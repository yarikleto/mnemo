---
name: common-electron-app-data-schema
description: Data agent designs the local persistence layer for a desktop Electron app from the system design — schema for better-sqlite3 (with WAL + foreign_keys + busy_timeout), Drizzle migrations keyed by `PRAGMA user_version`, encryption-at-rest via safeStorage-wrapped key + optional better-sqlite3-multiple-ciphers, rolling backup/restore plan, multi-window data coherence, atomic file writes via write-file-atomic. Produces `.claude/data-schema.md`. Use after system design is approved.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent, mcp__claude_ai_Excalidraw__read_me, mcp__claude_ai_Excalidraw__create_view, mcp__claude_ai_Excalidraw__export_to_excalidraw
argument-hint: "[--update to revise existing schema]"
---

# Electron Data Schema — Local Persistence Design

You are the CEO. The system design is approved. Now the **data** agent designs local persistence — the foundation a desktop app's state lives in. Schema mistakes haunt a desktop app forever because users have versions you can't migrate centrally.

## Step 1: Verify inputs

Check that these files exist:
- `.claude/system-design.md` — architecture, ADR-6 (persistence tier), high-level data model
- `.claude/product-vision.md` — user flows, "Why a desktop app?" section (offline? local-first? sensitive data?)
- `.claude/ceo-brain.md` — constraints, target platforms

If `$ARGUMENTS` contains `--update`, read `.claude/data-schema.md` and revise.

## Step 2: Brief the data agent

Send **data** with this brief:

> Read these files:
> - `.claude/system-design.md` — architect's persistence tier (ADR-6), data-model sketch, IPC channel map
> - `.claude/product-vision.md` — user flows: what data is created / read / updated / deleted; offline expectations; sensitivity
> - `.claude/ceo-brain.md` — constraints (timeline, platform support, encryption requirements)
>
> Design the complete local-persistence layer for this Electron app. Save it as `.claude/data-schema.md`.
>
> **Defaults you should follow unless the system design contradicts them:**
> - **Settings** (window bounds, last-opened file, prefs): **electron-store** v10+ (ESM-only since v9). Hard cap ~tens of KB.
> - **Relational user data**: **better-sqlite3** v11+ (synchronous N-API, ~2–10× faster than `sqlite3`).
> - **ORM**: **Drizzle on better-sqlite3**. `drizzle-kit generate` for migrations. Prefer over Prisma — Prisma's native query engine binary needs `extraResources` and is brittle.
> - **Avoid**: callback `sqlite3` (overhead on a sync engine), `sql.js` WASM (only when no native build option).
> - **Encryption at rest**: `safeStorage` (Keychain / DPAPI / libsecret) wraps a 32-byte random DB key, stored as wrapped blob in `userData`. For DB-level at-rest add **better-sqlite3-multiple-ciphers** (SQLCipher) and pass key via `PRAGMA key`.
> - **Migrations**: `PRAGMA user_version` as the truth. Forward-only, transactional per step. Refuse to open DBs whose `user_version` exceeds known — never silently downgrade.
> - **Backup**: `db.backup(path)` (online, non-blocking) or `VACUUM INTO`. Rolling N backups in `userData/backups/`. `PRAGMA integrity_check` on dirty open.
> - **IndexedDB / OPFS** (renderer): only for ephemeral renderer state. Anything that survives reinstall lives in main.
> - **Multi-window coherence**: DB ownership in main; renderers read/write via IPC; broadcast `data:changed` to all windows after writes; never poll.
> - **Atomic file writes** for non-DB files: `write-file-atomic`. File watches: `chokidar`, never raw `fs.watch`.
>
> The document MUST follow this structure:
>
> ````markdown
> # Data Schema
> > Version {N} — {date}
> > Based on system design v{N}
>
> ## 1. Storage Map
>
> | Layer | Technology | Location | What lives here |
> |-------|-----------|----------|-----------------|
> | Settings | electron-store v10+ | `userData/config.json` | Window bounds, last-opened file, user prefs (theme, locale) |
> | User data (relational) | better-sqlite3 v11+ + Drizzle | `userData/app.db` | All persistent business data |
> | Encrypted secrets | safeStorage-wrapped blob | `userData/secrets.bin` | API tokens, refresh tokens, DB key (if SQLCipher used) |
> | Renderer ephemeral | IndexedDB / OPFS | per-window storage | Drafts, scroll positions — anything that's safe to lose on reinstall |
> | User documents | filesystem (`write-file-atomic`) | `app.getPath('documents')` (only when user picks) | Files the user names and owns |
> | Backups | better-sqlite3 `db.backup` | `userData/backups/{N}.db` | Rolling N most recent backups |
>
> NEVER write inside the app bundle / install dir. Always under `app.getPath('userData')` or a user-chosen path.
>
> ## 2. SQLite Setup
>
> ### Open-time PRAGMAs (every connection)
> ```sql
> PRAGMA journal_mode = WAL;
> PRAGMA synchronous = NORMAL;
> PRAGMA foreign_keys = ON;
> PRAGMA busy_timeout = 5000;
> ```
>
> ### Connection model
> - **Owner:** main process. Renderers never touch the DB directly.
> - **Single connection** in main; better-sqlite3 is synchronous and serializes naturally.
> - **Heavy queries** (>100ms expected): move to a utility process and IPC the result back.
> - **Optional encryption:** when `better-sqlite3-multiple-ciphers` is used, pass the key via `PRAGMA key = '<key>'` immediately after open, BEFORE any other PRAGMA.
>
> ### Key management
> - Random 32-byte key generated on first run via `crypto.randomBytes(32)`.
> - Encrypted via `safeStorage.encryptString(...)` and written to `userData/secrets.bin`.
> - On launch: read blob → `safeStorage.decryptString(...)` → use as DB key.
> - On Linux without libsecret available, `safeStorage.isEncryptionAvailable()` is `false` — fall back to plaintext key with a clear user-facing warning, OR refuse to open (per product decision in `ceo-brain.md`).
>
> ## 3. ER Diagram
> <!-- Excalidraw diagram showing entities as boxes with key columns, relationships with cardinality.
>      Color-code by domain area if applicable. -->
>
> ## 4. Tables
>
> For each table:
>
> ### {table_name}
> **Purpose:** {one sentence}
>
> | Column | Type | Nullable | Default | Description |
> |--------|------|----------|---------|-------------|
> | `id` | INTEGER PRIMARY KEY AUTOINCREMENT | NO | auto | Internal primary key |
> | `public_id` | TEXT | NO | uuidv7 string | External / API-exposed ID |
> | `created_at` | INTEGER | NO | strftime('%s','now') | Unix epoch seconds (UTC) |
> | `updated_at` | INTEGER | NO | strftime('%s','now') | Unix epoch seconds (UTC) |
> | `deleted_at` | INTEGER | YES | NULL | Soft delete (if applicable) |
> | ... | ... | ... | ... | ... |
>
> **Constraints:**
> - PK: `id`
> - UNIQUE: `public_id`; `({col_a, col_b})` — {why}
> - FK: `{column}` → `{table}(id)` ON DELETE {CASCADE | SET NULL | RESTRICT}
> - CHECK: `{expression}` — {what it validates}
>
> **Indexes:**
> - `idx_{table}_{columns}` on `({columns})` — {what query, partial / expression / FTS5 if applicable}
>
> ---
>
> ## 5. Drizzle Schema (sketch)
>
> ```ts
> import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
>
> export const documents = sqliteTable('documents', {
>   id: integer('id').primaryKey({ autoIncrement: true }),
>   publicId: text('public_id').notNull().unique(),
>   title: text('title').notNull(),
>   body: text('body').notNull().default(''),
>   createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
>   updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`),
> }, (t) => ({
>   updatedIdx: index('idx_documents_updated').on(t.updatedAt),
> }));
> ```
>
> Full schema files live in `src/main/db/schema/*.ts`. This section is the contract.
>
> ## 6. Migrations
>
> ### Strategy
> - Forward-only. Each migration bumps `PRAGMA user_version` and runs in a single `BEGIN ... COMMIT`.
> - Generated by `drizzle-kit generate` and committed as `src/main/db/migrations/*.sql`.
> - On open: read `PRAGMA user_version`. If lower than the latest known — apply migrations in order. If higher — REFUSE to open (the user opened a newer-version DB on an older app; opening would corrupt). Surface a clear dialog and exit.
> - On dirty open (last close was unclean): run `PRAGMA integrity_check` before any writes.
>
> ### Initial migrations (sketch)
> ```
> 0001_initial_schema.sql        -- documents, prefs, attachments, ...
> 0002_add_documents_pinned.sql  -- ALTER TABLE documents ADD COLUMN pinned INTEGER DEFAULT 0
> ...
> ```
>
> ### Migration safety notes (desktop reality)
> - Every user has their own copy of the DB. You cannot run a "deploy migration" centrally.
> - Migrations MUST be tested against real databases produced by every released app version (keep a test corpus of fixture DBs).
> - Renames are dangerous in SQLite. Prefer add-column + dual-write + drop-column-in-later-release.
> - Add an UI-level "your data was migrated to v{N}" toast on first launch after a schema bump.
>
> ## 7. Multi-Window Coherence
>
> - DB ownership in main; renderers via IPC.
> - After every write, main broadcasts `data:changed` (push channel) to every open `BrowserWindow`. Payload: `{ entity, ids }` — small enough to be cheap; subscribers re-fetch the affected slices.
> - NEVER poll from the renderer.
>
> ## 8. Backups & Recovery
>
> - **Rolling backups**: on launch (if last backup is older than {N hours}), call `db.backup(...)` to `userData/backups/{ISO-timestamp}.db`. Keep N=7 most recent; rotate.
> - **Manual export**: surface "Export backup…" via a menu item — uses `db.backup` to a user-chosen path.
> - **Restore**: surface "Restore from backup…" — closes current DB, replaces the file, runs `integrity_check`, reopens. Always confirm + warn.
> - **Integrity check** on dirty open (`PRAGMA integrity_check`). On failure, refuse to open and offer "Restore from backup…".
>
> ## 9. Renderer Ephemeral Storage
>
> What's allowed in renderer IndexedDB / OPFS:
> - Draft text not yet saved (auto-saved to main every {N seconds})
> - Scroll positions, transient UI state
> - Cache of fetched assets that can be re-fetched
>
> What's NOT allowed in renderer:
> - Anything the user expects to keep across reinstall
> - Anything that contradicts the source of truth in main
>
> Reasoning: renderer storage gets cleared by some users via DevTools / browser-data clears; it's also separate per BrowserWindow partition unless explicitly shared.
>
> ## 10. File Storage (non-DB)
>
> - User-named files (the user picks the path): write via `write-file-atomic` to avoid partial writes on power loss.
> - File watches: **chokidar** (never raw `fs.watch`) — `fs.watch` has well-known cross-platform inconsistencies.
> - Always parse user paths through `path.normalize` and reject `..` traversal beyond the user-chosen root.
>
> ## 11. Privacy & Security
>
> - PII columns enumerated with sensitivity level.
> - Encryption-at-rest: { off | safeStorage-wrapped key + plaintext SQLite | safeStorage-wrapped key + better-sqlite3-multiple-ciphers (SQLCipher) }.
> - GDPR-style "delete all my data": one IPC handler that closes the DB, deletes `userData/app.db`, `userData/backups/*`, and `userData/secrets.bin`, then quits.
> - Never bundle secrets in asar — `safeStorage` is the only sanctioned home for tokens / keys that must persist.
>
> ## 12. Open Questions
> <!-- Things that need decisions: encryption posture per platform, backup retention, FTS5 vs in-memory search, etc. -->
> ````
>
> **Rules:**
> - Default to better-sqlite3 + Drizzle. Justify any deviation in writing.
> - Start in 3NF. Denormalize only with documented justification.
> - Every business table: internal `id` (INTEGER), external `public_id` (UUIDv7 as TEXT), `created_at`, `updated_at`.
> - Every FK has an index.
> - NOT NULL on every column unless NULL has genuine semantic meaning.
> - Money: integer minor units (`amount_cents INTEGER`). Currency stored alongside. NEVER float.
> - Timestamps: Unix epoch seconds (INTEGER) in UTC. Convert at the renderer for display.
> - Keys ALWAYS via `safeStorage`. Never plaintext to disk.
> - Migrations forward-only, transactional, gated by `PRAGMA user_version`. Never silently downgrade.
> - DB ownership in main; renderers via IPC; `data:changed` broadcast after writes.
> - File writes atomic (`write-file-atomic`). File watches via `chokidar`.
> - NEVER write inside the app bundle / install dir.
> - electron-rebuild is deprecated — always `@electron/rebuild` for native module rebuilds.

## Step 3: Review

Read the schema. Check:
- Properly normalized? No god tables, no redundant data without justification.
- Every FK indexed?
- Constraints comprehensive? NOT NULL, CHECK, UNIQUE, FK where needed?
- Open-time PRAGMAs include WAL + foreign_keys + busy_timeout?
- Migration plan gates on `PRAGMA user_version` and refuses higher versions?
- Backup strategy concrete — rolling N, integrity check on dirty open?
- Multi-window coherence: writes in main, `data:changed` broadcast, no polling?
- Encryption posture explicit per platform (libsecret availability on Linux)?
- File writes atomic? File watches via chokidar?
- Engine choice justified? Did we accidentally pick Prisma when Drizzle would do?

If issues, send data agent back.

## Step 4: Update CEO brain

Update `.claude/ceo-brain.md`:
- "Key Decisions Log" → data schema designed: better-sqlite3 v11+ + Drizzle ({N} tables); encryption: {off / safeStorage / SQLCipher}; backup: rolling {N}
- "Architecture Overview" → add data layer summary

## Step 5: Present to client

> "Local persistence designed: better-sqlite3 with WAL + foreign-keys, Drizzle for migrations gated by `PRAGMA user_version`.
> {N} tables. Encryption: {chosen posture}. Rolling {N} backups; integrity check on dirty open.
> {Any client decisions needed — e.g., 'On Linux without libsecret, do we want a clear-text fallback or a hard refusal?'}"
