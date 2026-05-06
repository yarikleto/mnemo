---
name: common-electron-app-tester-plan
description: Tester drafts a test strategy for an Electron desktop app from the system design — pyramid shape, framework picks (Vitest for renderer + main pure modules; Playwright `_electron.launch()` against the **packaged** build with electron-playwright-helpers; zod IPC contract tests; @axe-core/playwright for renderer a11y), per-test userData isolation, single-instance-lock disable in tests, Linux CI `xvfb-run`, coverage map per task, Definition of Done. Use after system design and task breakdown are approved.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent
argument-hint: "[--update to revise existing test plan]"
---

# Electron Test Plan — Test Strategy from System Design

You are the CEO. The system design and task breakdown are ready. Before anyone writes code, you need a test strategy — the **tester** defines HOW the desktop app will be tested, WHAT tools to use, and WHERE each type of test lives.

## Step 1: Verify inputs

Check that these files exist:
- `.claude/system-design.md` — architecture, IPC channel map, fuses, auto-update plan
- `.claude/tasks/` — task files (one per task) with acceptance criteria
- `.claude/product-vision.md` — user flows
- `.claude/data-schema.md` — schema (informs DB-isolation strategy)

Also detect the existing stack so framework picks aren't theoretical:
- `package.json` (look for `vitest`, `jest`, `playwright`, `@playwright/test`, `electron-playwright-helpers`, `@axe-core/playwright`, `@testing-library/*`, `wdio`, `webdriverio`)

If `$ARGUMENTS` contains `--update`, read `.claude/test-plan.md` and revise.

## Step 2: Brief the tester

Send **tester** with this brief:

> Read these files:
> - `.claude/system-design.md` — architecture, IPC channel map (every channel is a contract test), fuses, auto-update plan
> - `.claude/tasks/` — every task and its acceptance criteria
> - `.claude/product-vision.md` — core user flows (these become the E2E spec list)
> - `.claude/data-schema.md` — DB shape (informs per-test isolation strategy)
> - `package.json` — what's already installed
>
> Produce a test strategy for this **desktop Electron application**. Save it as `.claude/test-plan.md`.
>
> **Default framework picks (override only if the project already uses something else):**
> - **Renderer unit + component**: **Vitest** + `@testing-library/<react|vue|svelte>` + `@testing-library/user-event`. Jest only if the codebase is already on it.
> - **Main process unit**: plain **Vitest** in Node env. **Do NOT boot Electron** for unit tests — mock the `electron` module. Extract IPC handler bodies into pure functions; register them in a thin `registerIpc(ipcMain)` wrapper. The pure functions are what unit tests cover.
> - **E2E**: **Playwright `_electron.launch()`** + **`electron-playwright-helpers`** (npm) — adds `stubDialog`, `clickMenuItemById`, multi-window helpers. Run E2E against the **packaged** build in CI (asar paths, `app.isPackaged` branches, signed entitlements differ from dev — testing dev only is testing the wrong thing).
> - **WebdriverIO Electron Service**: alternative when team already on WDIO or needs Selenium Grid; `browser.electron.mock()` is genuinely nicer for `dialog` / `app` / `shell` mocking.
> - **IPC contract tests**: zod schemas in a shared package; both `ipcMain.handle` and the preload wrapper `.parse()` at runtime; round-trip fixtures through the schemas without booting Electron.
> - **Accessibility**: **@axe-core/playwright** against renderer pages. Native menus / tray / dialogs are NOT in the DOM — flag those for `manual-qa`.
> - **Linux CI**: **`xvfb-run`** (no true headless mode in Electron — it always wants a display).
> - **Single-instance lock + tests**: disable lock under `NODE_ENV === 'test'`. Otherwise the second Playwright launch in the same suite gets denied.
> - **Per-test isolation**: `app.setPath('userData', tmpdir())` per test, OR wipe `userData` in `afterEach`. Tests must not see each other's DB / settings.
>
> The document MUST follow this structure:
>
> ````markdown
> # Test Strategy
> > Version {N} — {date}
>
> ## 1. Testing Philosophy
> <!-- For THIS Electron app:
>      - QA verification approach: tests written after implementation
>      - Pyramid shape: many renderer + main-pure unit, fewer IPC contract, fewer still E2E (only golden user paths)
>      - Target distribution (e.g., 70% unit / 20% IPC contract / 10% E2E)
>      - Classicist (real objects) or mockist? Why for this project? -->
>
> ## 2. Test Frameworks & Tools
>
> | Layer | Framework | Runner | Why this project |
> |-------|-----------|--------|------------------|
> | Renderer unit | Vitest | `vitest run` | Native ESM, pairs with electron-vite |
> | Renderer component | RTL/Vue Test Utils + user-event | Vitest | Behavior via the rendered DOM |
> | Main pure | Vitest in Node env | `vitest run` | IPC handler bodies as pure functions; mock `electron` module |
> | IPC contract | Vitest + zod | `vitest run` | Round-trip fixtures through shared schemas — no Electron boot |
> | E2E | Playwright `_electron.launch()` + electron-playwright-helpers | `playwright test` | First-class Electron support; runs against packaged build |
> | a11y (renderer) | @axe-core/playwright + jest-axe / vitest-axe | — | Fails on serious/critical violations |
> | Visual regression (light) | Playwright `toHaveScreenshot()` | — | Critical screens only |
>
> ### Test Doubles Strategy
> - **Default to real objects** for renderer + main-pure (classicist). Use doubles only at the Electron-API boundary.
> - **`electron` module**: mocked in main-pure unit tests via `vi.mock('electron', ...)`. The pure handler functions take dependencies as args, so most tests don't need the mock.
> - **Database**: real better-sqlite3 in tests, opened at a per-test temp path. The app code is identical to production; only the path differs.
> - **`dialog` / `shell`**: stubbed via `electron-playwright-helpers.stubDialog` in E2E.
> - **`safeStorage`**: in tests, return a constant key (`safeStorage.isEncryptionAvailable()` is `false` in headless Linux; the code branch must handle it).
> - **Outbound HTTP**: `nock` (Node-side) or MSW (renderer-side) — never real network in CI.
>
> ### Determinism Rules (non-negotiable)
> - Clock frozen via `vi.useFakeTimers()` / `vi.setSystemTime()`.
> - RNG seeded or injected; `crypto.randomBytes` mockable in tests.
> - TZ pinned (UTC) and LANG pinned in test env.
> - Animations disabled in component and E2E tests (`prefers-reduced-motion: reduce` plus app-level transition gates).
> - Awaits via `findBy*` / `waitFor` / Playwright auto-wait — never `setTimeout` / `waitForTimeout`.
>
> ### Per-Test Isolation (Electron-specific)
> - **userData**: each test sets `app.setPath('userData', tmpdir())` OR wipes `userData/app.db`, `userData/config.json`, `userData/secrets.bin`, `userData/backups/` in `afterEach`. Pick one and stick to it.
> - **Single-instance lock**: under `NODE_ENV === 'test'`, the lock is disabled — otherwise the second test launches gets denied and silently exits.
> - **App quit between tests**: explicitly `electronApp.close()` in `afterEach`. A leaked Electron process pins port-bindings and DB locks.
> - **Window state**: Tests that depend on window bounds clear electron-store first.
>
> ### CI Integration
> - **PR**: type-check + lint + Vitest (renderer + main-pure + IPC contract) — target <3 min.
> - **Merge to main**: + Playwright E2E against the **packaged** build, per platform in the CI matrix, + axe + visual regression.
> - **Linux runner**: every Playwright job wraps with `xvfb-run -- npx playwright test`.
> - **Parallelization**: shard Vitest by file; one Playwright project per OS in the matrix.
> - **Flake quarantine**: fail loud, never auto-retry without an issue link.
>
> ## 3. Testing Pyramid for This Project
>
> ### Unit + Component (many, fast)
> <!-- List specific modules / components and what to test:
>      - "src/main/db/documents.ts — repository CRUD against real better-sqlite3 at tmpdir"
>      - "src/main/ipc/docs.ts — pure handler functions: zod validation, error shapes, origin check"
>      - "src/renderer/components/EditorTab.tsx — render, dirty indicator, close-with-confirm (RTL + user-event)"
>      - "src/renderer/hooks/useDataChanged.ts — listens to `data:changed` push channel; mock IPC client" -->
>
> ### IPC Contract (some, medium)
> <!-- For each channel in system-design §5: a test that round-trips a representative payload through the zod schema (no Electron boot).
>      - "docs:save — valid payload parses; missing field rejects; oversized body rejects"
>      - "prefs:read — unknown key returns structured error; valid key returns value"
>      - "updater:check — response shape matches" -->
>
> ### E2E (few, slow — packaged build only)
> <!-- ONE happy path per critical user flow. Map to product-vision flows.
>      Keep this list SHORT (5-15 specs typical for an MVP).
>      - "Flow 1: Cold start → window appears → primary action → close. Verifies TC-1, TC-3."
>      - "Flow 2: Open file from menu → edit → save (Cmd+S) → restart → file is restored. Verifies TC-2."
>      - "Flow 3: Auto-update happy path against staging update server. Verifies TC-4."
>      - "Flow 4: Multi-window — open second window → edit doc in window A → window B sees `data:changed`. Verifies TC-?." -->
>
> ### Accessibility
> <!-- Which renderer pages get axe-core?
>      - All primary screens via Playwright + axe (run inside the packaged-app E2E)
>      - All form components via vitest-axe in component tests
>      - Fail on serious/critical violations
>      - Native menus / tray / dialogs not in DOM — flag for manual-qa -->
>
> ### Out of scope for automated tests (manual-qa territory)
> - Native menus (mac global menu bar, in-window menu bar, GNOME header bar)
> - Tray icon behavior, dock badges, taskbar progress
> - Native a11y (VoiceOver / Narrator / Orca)
> - HiDPI / per-monitor DPI
> - Sleep / wake / lid close (`powerMonitor`)
> - First-run trust prompts (Gatekeeper, SmartScreen, AppImage)
> - Drag-drop from Finder / Explorer / Nautilus
>
> ## 4. Test Coverage Map
>
> | Task | Renderer | Main pure | IPC contract | E2E | a11y | Test Design Technique |
> |------|----------|-----------|--------------|-----|------|----------------------|
> | TASK-001 | — (scaffolding) | — | — | — | — | — |
> | TASK-002 | — | health:ping handler | health:ping schema | window-opens spec | — | Smoke |
> | TASK-005 | EditorTab.tsx | docs:save handler | docs:save schema | save-restart-restore spec | editor screen (axe) | State transitions, boundary values |
> | TASK-008 | — | updater state machine | updater:* schemas | update-applies spec (against staging server) | — | State transitions, error guessing |
> | ... | ... | ... | ... | ... | ... | ... |
>
> ## 5. Test Design Techniques by Area
>
> | Area | Techniques | Why |
> |------|-----------|-----|
> | IPC payload validation | Equivalence partitioning, boundary values | Many input classes with clear edges |
> | Schema migrations | Decision tables, error guessing | `user_version` paths interact; high blast radius |
> | Auto-update state machine | State transitions | Idle / Checking / Downloading / Ready / Error transitions |
> | Multi-window coherence | Pairwise testing | Window count × write source × subscriber state |
> | File IO | Boundary values, error guessing | Permission errors, atomic-write failure modes, traversal attempts |
> | Renderer components | Behavior via DOM (RTL queries by role/label) | Test what the user sees |
>
> ## 6. Test File Conventions
>
> ```
> src/
>   main/
>     db/
>       documents.ts
>       documents.test.ts                  ← unit (real sqlite at tmpdir, co-located)
>     ipc/
>       docs.ts
>       docs.test.ts                       ← unit on pure handler bodies
>       docs.contract.test.ts              ← zod round-trip
>   renderer/
>     components/
>       EditorTab.tsx
>       EditorTab.test.tsx                 ← component (RTL, co-located)
>
> tests/
>   factories/
>     document.factory.ts                  ← test data builders
>   helpers/
>     packaged-app.ts                      ← spawns _electron.launch against the packaged build
>
> e2e/
>   smoke/
>     window-opens.spec.ts                 ← Playwright E2E
>   docs/
>     save-restart-restore.spec.ts
>   updater/
>     happy-path.spec.ts
> ```
>
> Naming: `{module}.test.ts` for unit, `{module}.contract.test.ts` for IPC contract, `{flow}.spec.ts` for E2E.
> Pattern: Arrange/Act/Assert. RTL queries in priority order (role > label > text > test ID). No `data-testid` unless nothing else works.
>
> ## 7. Definition of Done (Testing)
>
> Applies to EVERY task:
> - [ ] All renderer + main-pure + IPC contract tests pass on PR
> - [ ] No flaky tests introduced (run the suite 3× locally if in doubt)
> - [ ] No skipped/disabled tests, no `.only`, no `xit`/`xdescribe`
> - [ ] Acceptance criteria each map to at least one assertion
> - [ ] Regression suite green
> - [ ] Type-check + lint pass on test files
> - [ ] No real network calls in unit / IPC contract tests
> - [ ] No real clock / RNG dependence in any test
> - [ ] Per-test isolation respected — no test relies on another test's userData
>
> ## 8. Adversarial Testing Checklist
>
> For every task, the tester also considers:
> - [ ] Null / empty / whitespace / unicode / emoji / RTL inputs in IPC payloads
> - [ ] Boundary values (0, 1, MAX-1, MAX, MAX+1)
> - [ ] Wrong types in IPC (string where number expected) — zod must reject
> - [ ] Origin check: payload from non-app-protocol senderFrame must reject
> - [ ] eval / `new Function` / `webContents.executeJavaScript` on dynamic input — reviewer enforces; tests verify the safe path is the only one
> - [ ] DB: concurrent writes from two windows; broken DB file (truncated, wrong header)
> - [ ] safeStorage: encryption available vs not (Linux without libsecret)
> - [ ] electron-updater: signature verification disabled scenario (test that the build refuses to start with `verifyUpdateCodeSignature: false`)
> - [ ] Single-instance lock: launch a second instance, verify primary receives the args and second exits
> - [ ] Window restore: saved bounds outside any current display → clamped to primary
>
> ## 9. Risks
> <!-- Testing-specific risks for THIS Electron app:
>      - Playwright _electron flakiness on Windows runners (well-known) — mitigation: longer timeouts, retry on infra error only
>      - Native module rebuild differences across CI runner archs
>      - Notarization + staple required before macOS E2E (else first launch is denied) — mitigation: notarize before E2E job
>      - safeStorage unavailable on Linux runner (libsecret) — mitigation: branch in code; tests cover both paths -->
> ````
>
> **Rules:**
> - Every choice must be justified for THIS Electron app. No "we'll use Jest because it's popular" — Vitest unless the project already runs Jest.
> - Coverage map must account for every task in `.claude/tasks/`.
> - E2E runs against the **packaged** build in CI — `app.isPackaged` branches and asar paths differ from dev.
> - Linux E2E always under `xvfb-run`. There's no true headless mode in Electron.
> - Per-test userData isolation is non-negotiable — leaks make tests order-dependent and impossible to debug.
> - `requestSingleInstanceLock` disabled under `NODE_ENV === 'test'`.
> - This is a **desktop Electron app**. If the brief points elsewhere (web SaaS, mobile-native, CLI, embedded), refuse and tell the CEO.

## Step 3: Review

Read the test plan. Check:
- Pyramid shape fits the architecture (heavy renderer → more component tests; thin renderer over rich main → more main-pure)
- Framework picks match what's already installed, or are justified replacements
- Every task is covered in the coverage map
- E2E runs against the packaged build (NOT against `npm run dev`)
- Per-test userData isolation strategy is concrete (tmpdir per test OR wipe in afterEach)
- `requestSingleInstanceLock` disabled in tests
- Linux CI uses `xvfb-run`
- Determinism rules cover clock, RNG, TZ, animations
- Definition of Done is achievable on every PR

If issues, send tester back with specific feedback.

## Step 4: Update CEO brain

Update `.claude/ceo-brain.md`:
- "Current State" → test strategy defined, ready to start development
- "Key Decisions Log" → test plan approved: Vitest + Playwright `_electron`, packaged-build E2E, per-test userData isolation, xvfb-run on Linux

## Step 5: Present to client

Brief summary:
- "Here's how we'll ensure quality: pyramid shape — many renderer + main-pure unit tests, fewer IPC contract tests, fewer still E2E"
- "Frameworks: Vitest + Playwright `_electron` against the packaged build, plus axe-core for renderer a11y"
- "Native UI (menus / tray / dialogs / a11y) is covered by manual-qa, not automated tests — that's by design"
- "Critical paths covered by E2E: {list, 5–15 items}"

Ask: "Any concerns? Ready to start building?"
