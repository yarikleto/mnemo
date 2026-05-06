---
name: common-electron-app-architect-tasks
description: Architect decomposes the approved Electron-app system design into milestones and INVEST-sized vertical-slice tasks (UI + IPC + main-process logic + persistence + packaging) with acceptance criteria, dependencies, and a parallelization plan (the **Tasks** phase of the spec-driven loop). Each task declares which system-design verification criteria it advances. Starts with a concrete walking skeleton — window opens → IPC roundtrip → persistence read/write → packaged installer signed + notarized + self-updating. Use after system design is approved.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent, mcp__claude_ai_Excalidraw__read_me, mcp__claude_ai_Excalidraw__create_view, mcp__claude_ai_Excalidraw__export_to_excalidraw
argument-hint: "[--update to revise existing tasks]"
---

# Architect Tasks — Decompose System Design into Tasks

You are the CEO. The system design is approved. Send the **architect** to break it into a concrete, executable task plan the team can pick up and run with.

## Step 1: Verify inputs

Check that these files exist:
- `.claude/system-design.md` — the approved system design
- `.claude/product-vision.md` — the product vision
- `.claude/design-spec.md` — design tokens, components, screens
- `.claude/menu-map.md` — per-platform menu structure
- `.claude/shortcut-map.md` — accelerator inventory
- `.claude/ceo-brain.md` — CEO knowledge base

If `$ARGUMENTS` contains `--update`, read `.claude/tasks/_overview.md` and relevant task files first — architect revises, not starts from scratch.

## Step 2: Brief the architect

Send **architect** with this brief:

> Read these files:
> - `.claude/system-design.md` — full system design with ADRs, IPC channel map, process model, fuses, auto-update plan
> - `.claude/product-vision.md` — vision, user flows, target platforms, distribution channels
> - `.claude/design-spec.md` — design tokens, component inventory, screen map with visual acceptance criteria
> - `.claude/menu-map.md` — per-platform menu structure (informs menu-wiring tasks)
> - `.claude/shortcut-map.md` — accelerators (informs accelerator-wiring tasks)
> - `.claude/prototypes/README.md` — find the latest approved prototype
> - The latest prototype HTML file — actual screens and interactions
>
> Produce a complete task breakdown. Save it as individual files in `.claude/tasks/` — one file per task.
>
> ## How to Decompose
>
> ### 1. Identify the Walking Skeleton
>
> The walking skeleton is the FIRST milestone — the thinnest end-to-end slice that exercises EVERY major architectural component. For an Electron app this is concrete:
>
> 1. **Window opens** — main process boots, primary window appears with secure webPreferences, no white flash (`ready-to-show` + `backgroundColor`).
> 2. **IPC roundtrip** — preload exposes one typed wrapper; renderer calls it; main responds; result rendered in the UI.
> 3. **Persistence read/write** — write a single value through better-sqlite3 (or electron-store), restart, read it back on next launch.
> 4. **Packaged installer** — produce DMG + NSIS + AppImage; smoke-test the installers locally.
> 5. **Signed + notarized** — macOS Developer ID + `@electron/notarize` + staple; Windows signed (Azure Trusted Signing or pinned alternative).
> 6. **Self-updating** — electron-updater (or update-electron-app) wired to a staging channel; a real update lands on a real test machine.
>
> The walking skeleton should take 1-2 weeks to build. Anything beyond this is Milestone 1+.
>
> ### 2. Slice Vertically, Not Horizontally
>
> Every task must be a **vertical slice** through the Electron stack — renderer UI + preload bridge + main IPC handler + persistence (and any window/menu/accelerator wiring touched). Never create horizontal tasks like "set up all IPC channels," "build all screens," or "design the schema." (Schema work belongs in `/common-electron-app-data-schema`, not as a task.)
>
> Apply the **Elephant Carpaccio** mindset: always ask "can this be sliced thinner?" Each slice must:
> - Touch real UI (or a real packaging/signing step if no UI)
> - Work end-to-end (renderer ↔ preload ↔ main ↔ disk)
> - Be visibly different from the previous slice
> - Deliver testable value
>
> ### 3. Apply INVEST to Every Task
>
> - **Independent** — minimize coupling
> - **Negotiable** — describes the GOAL, not HOW
> - **Valuable** — observable value to the user or system
> - **Estimable** — clear enough to size; otherwise create a spike
> - **Small** — 1-3 acceptance criteria ideal, 4-6 max
> - **Testable** — clear pass/fail acceptance criteria
>
> ### 4. Size Each Task — SPLIT AGGRESSIVELY
>
> **Smaller tasks = better agent quality.** Each task runs developer → reviewer (and tester / designer / ux-engineer where applicable) with isolated context.
>
> **Prefer many S over fewer M. Prefer M over L. Avoid L whenever possible.**
>
> Sizing by complexity:
> - **S** — 1-3 acceptance criteria, touches 1-2 files (e.g., "add `prefs:read` IPC handler with zod validation", "wire Cmd+S accelerator to `docs:save`")
> - **M** — 4-6 acceptance criteria, touches 3-5 files (e.g., "document tab UI: open file from dialog → render in tab → close with confirm")
> - **L** — 7+ acceptance criteria, touches 5+ files. **Warning sign — split further.**
>
> **Splitting rules:**
> - **L MUST be split** into S or M.
> - **M SHOULD be split** if it has more than 5 acceptance criteria or touches more than one screen / IPC namespace.
> - When in doubt — split.
>
> **How to split for Electron specifically:**
> - **By process boundary:** "Renderer UI for save flow" and "main IPC handler for `docs:save`" can be two tasks if you ship a stub handler first.
> - **By IPC channel:** "`docs:save`" and "`docs:load`" are two tasks, not "doc CRUD."
> - **By screen section:** "Window chrome + menu bar" and "Tab strip" and "Editor pane" are three tasks.
> - **By platform:** "Sign + notarize macOS build" and "Sign Windows build (Azure Trusted Signing)" and "AppImage build" are three packaging tasks.
> - **By state:** "Cold-start deep link" and "Warm-start deep link via `second-instance`" are separate.
> - **By error path:** Happy path in one task, error/retry in another.
>
> Create **spike** tasks for unknowns — time-boxed research (always S) producing a decision or proof of concept, not code.
>
> ### 5. Write Acceptance Criteria
>
> Every task gets acceptance criteria in **Given/When/Then** or **checklist**:
>
> ```
> Given the app is launched on macOS
> When the user presses Cmd+S with unsaved changes
> Then the document is persisted via `docs:save` and the title bar removes the modified-dot indicator
> ```
>
> Or:
>
> ```
> - [ ] `docs:save` IPC handler validates payload via zod
> - [ ] Returns `{ ok: true, public_id }` on success
> - [ ] Returns `{ ok: false, code, message }` on validation failure
> - [ ] Origin check rejects requests from non-app-protocol senders
> ```
>
> ### 6. Map Dependencies
>
> For each task: **Depends on**, **Blocks**, **Parallel with**.
>
> Minimize dependencies. Define IPC contracts (zod schemas) early so renderer and main tasks can run in parallel against contracts.
>
> ### 7. Identify the Critical Path
>
> The longest chain of dependent tasks. Highlight it.
>
> ### 8. Define the Execution Flow for Each Task
>
> 1. **Developer** implements the feature with full freedom (renderer + preload + main where applicable).
> 2. **Tester** (on demand) verifies critical IPC contracts and packaged-build behavior.
> 3. **Reviewer** reviews code, tests, separation of concerns, security red lines.
> 4. **Designer** + **ux-engineer** (UI tasks) review against design spec / HIG.
>
> ## Output Format
>
> Save tasks as **individual files** in `.claude/tasks/` — one file per task.
>
> ### File: `.claude/tasks/_overview.md`
>
> ````markdown
> # Task Breakdown
> > Generated from system design v{N} — {date}
>
> ## Summary
> - Total milestones: {N}
> - Total tasks: {N}
> - Estimated critical path: {N days/weeks}
> - Walking skeleton: Milestone 0 ({N tasks}, ~{N days}) — ends with a SIGNED + NOTARIZED installer that self-updates
>
> ## Dependency Graph
> <!-- Excalidraw diagram. Milestones as groups, tasks as nodes, dependencies as arrows. Critical path highlighted. -->
>
> ## Task Statuses
>
> | Status | Meaning | Next Step |
> |--------|---------|-----------|
> | `TODO` | Not started | Developer picks it up |
> | `IN_PROGRESS` | Developer is implementing + testing | Wait for developer |
> | `IN_REVIEW` | Developer done, reviewer checking | Wait for reviewer |
> | `CHANGES_REQUESTED` | Reviewer found issues | Developer fixes |
> | `DONE` | Reviewer approved, all criteria met | Move to next task |
> | `BLOCKED` | Waiting on dependency or external (e.g. signing cert from client) | Resolve blocker first |
>
> ## Definition of Done (applies to ALL tasks)
> - [ ] Developer implemented the feature and wrote tests
> - [ ] All tests pass (Vitest renderer + main pure; Playwright `_electron` E2E for E2E-flagged tasks)
> - [ ] Reviewer verified goal is achieved, tests are meaningful, code quality is acceptable
> - [ ] Reviewer verified Electron red lines (webPreferences, IPC zod + senderFrame check, no raw ipcRenderer exposure, no eval/new Function on dynamic input, electron-updater ≥ 6.3.9, @electron/rebuild not electron-rebuild)
> - [ ] No linter / typecheck warnings
> - [ ] Status updated to `DONE`
>
> ---
>
> ## Milestone 0: Walking Skeleton
> > Goal: real signed installer that opens, completes one IPC roundtrip, persists one value, and self-updates.
> > Tasks: TASK-001 ... TASK-008
>
> ## Milestone 1: {Core Feature Name}
> > Goal: {what the user can do after this milestone}
> > Tasks: TASK-0XX, TASK-0XX, ...
>
> ## Milestone 2: {Next Feature}
> > ...
>
> ---
>
> ## Critical Path
> TASK-001 → TASK-002 → TASK-005 → TASK-008 → TASK-012 → ...
> Estimated duration: {N days}
>
> ## Parallelization Opportunities
> - After TASK-002 (IPC contracts defined): renderer-side TASK-00X and main-side TASK-00Y can run in parallel
> - Packaging tasks (mac signing / Windows signing / Linux AppImage) can run in parallel after the unsigned package builds
> - ...
>
> ## Nice-to-Haves (~)
> - ~TASK-0XX: {feature that's nice but not essential — Snap/Flatpak, MSIX, MAS}
>
> ## Verification Criteria Coverage
> | TC | Task(s) | Status |
> | --- | --- | --- |
> | TC-1 | TASK-005, TASK-008 | covered |
> | TC-2 | TASK-006 | covered |
> | TC-6 (fuses) | TASK-007 (signing) | covered |
> | TC-X | — | **GAP — needs a task** |
> ````
>
> ### File: `.claude/tasks/TASK-001.md`
>
> ````markdown
> # TASK-001: Project scaffolding (Forge / electron-builder + electron-vite)
> **Milestone:** 0 — Walking Skeleton
> **Status:** `TODO`
> **Size:** S | **Type:** setup
> **Depends on:** nothing
> **Verifies:** infrastructure
> **Goal:** A new clone runs `npm install && npm run dev` and sees a window with the project name. Build tool is wired but no app code yet.
> **Acceptance Criteria:**
> - [ ] `package.json` declares electron, the chosen builder, and electron-vite
> - [ ] `forge.config.*` (or `electron-builder.json`) committed with target platforms from ADR-4
> - [ ] `npm run dev` opens a window
> - [ ] `.gitignore` excludes `out/`, `dist/`, `release/`, `node_modules/`
> **Cycle:** developer only (no tests for scaffolding) → reviewer
> ````
>
> ### File: `.claude/tasks/TASK-002.md`
>
> ````markdown
> # TASK-002: Secure window + IPC roundtrip skeleton
> **Milestone:** 0 — Walking Skeleton
> **Status:** `TODO`
> **Size:** M | **Type:** vertical-slice
> **Depends on:** TASK-001
> **Verifies:** TC-1, TC-5
> **Screen:** Primary window
> **Goal:** The primary window opens with secure webPreferences, no white flash, and the renderer receives a structured response from a `health:ping` IPC call.
> **Acceptance Criteria:**
> - [ ] `BrowserWindow` configured with `{ contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false }`
> - [ ] Window uses `ready-to-show` + `backgroundColor` to avoid white flash
> - [ ] Preload exposes `window.api.healthPing()` via `contextBridge` (no raw ipcRenderer)
> - [ ] `ipcMain.handle('health:ping', …)` validates payload via zod, returns `{ ok: true, version }`
> - [ ] Renderer calls `window.api.healthPing()` and renders the version
> - [ ] CSP set per ADR-3 (`default-src 'none'; script-src 'self'; …`)
> - [ ] `app.requestSingleInstanceLock()` + `second-instance` handler in place
> **Visual Criteria:** N/A (skeleton)
> **Cycle:** developer (implements + tests via Vitest for the IPC handler purity, Playwright `_electron` for the roundtrip) → reviewer
> ````
>
> ### File: `.claude/tasks/SPIKE-001.md`
>
> ````markdown
> # SPIKE-001: Confirm Windows ARM packaging path
> **Milestone:** Spikes
> **Status:** `TODO`
> **Size:** S | **Timebox:** 4 hours
> **Question:** Does `@electron/rebuild` produce working native modules on the GH `windows-11-arm` runner for our chosen DB engine?
> **Deliverable:** Decision (ship / drop / defer Windows ARM) + minimal repro repo if we hit a blocker
> **Cycle:** researcher → CEO decision
> ````
>
> **Rules:**
> - **Tasks describe the GOAL, not the HOW.** Implementation details (file names, function signatures, specific patterns) are the developer's decision.
> - **Every non-setup task MUST declare `**Verifies:**`** — at least one TC-ID from `.claude/system-design.md` §13. This is the spec→implementation lineage.
> - **Coverage check:** every TC in §13 MUST be advanced by ≥1 task by the end of the last milestone. List uncovered TCs in `_overview.md` so they can't slip.
> - One file per task in `.claude/tasks/`. File name = task ID.
> - Walking skeleton is ALWAYS Milestone 0. The skeleton ends with a SIGNED + NOTARIZED installer that self-updates — anything less isn't a skeleton.
> - Every task is a vertical slice unless it's scaffolding, packaging, or signing infrastructure.
> - No L-sized tasks — split into S or M. Prefer S.
> - Every task has acceptance criteria.
> - Dependencies are explicit. No hidden coupling.
> - Critical path is highlighted.
> - Nice-to-haves marked with ~.
> - Execution flow explicit: developer (implements + tests) → reviewer (always).

## Step 3: Review the task breakdown

When the architect returns, read it yourself. Check:

- **Walking skeleton complete?** Does Milestone 0 end with a SIGNED + NOTARIZED installer that self-updates? If signing or auto-update is deferred to Milestone 1 — send back. The skeleton must prove the entire pipeline.
- **Tasks small enough?** Most tasks should be S. Send back if M or L dominate.
- **Vertical slices?** No "set up all IPC handlers" or "design all screens." If you see a horizontal task — send back.
- **Goals, not instructions?** If the Goal field has file paths or function names, send back: "Describe the goal, not the implementation."
- **Acceptance criteria clear?** Could the developer write meaningful tests from these?
- **Spec lineage closed?** Every non-setup task has `**Verifies:**`. Coverage table shows zero gaps.
- **Per-platform packaging tasks present?** Sign macOS + sign Windows + Linux AppImage are typically three separate tasks because the failure modes are different.
- **Dependencies minimize bottlenecks?** Renderer-side and main-side tasks can run in parallel after IPC contracts are agreed.
- **100% coverage?** Does the task list account for everything in the system design?

If issues, send architect back with specific feedback.

## Step 4: Update the CEO brain

Update `.claude/ceo-brain.md`:
- "Current State" → task breakdown approved, ready for implementation
- "Strategic Priorities" → first milestone (walking skeleton)
- "Key Decisions Log" → task breakdown approved, {N} milestones, {N} tasks

## Step 5: Present to the client

Brief executive summary:

- "{N} milestones, {N} tasks total"
- "We start with the walking skeleton — a real signed installer that opens, persists one value, and self-updates — takes about {N days}"
- "Then {milestone 1}, then {milestone 2}…"
- "Critical path is {N days/weeks}"
- Show the dependency graph diagram
- Flag any client actions needed before sprint can start (signing certs, Apple Developer enrollment, Azure Trusted Signing setup)

Ask: "Ready to start building?"
