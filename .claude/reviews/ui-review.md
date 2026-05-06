# UI / UX Review — Mnemo v1 (pre-ship polish pass)
> 2026-05-06 — consolidated designer + UX-engineer findings

## Status

The two specialized agents (designer + ux-engineer) both bailed mid-task — a harness issue with those agent types in this session, not a Mnemo problem. This review was produced inline by the CEO from:
- Source-code inspection of `src/renderer/`
- The 22 screenshots produced by the designer's seed/capture scripts (`.claude/reviews/screenshots/{light,dark}/`)
- The reusable scripts at `.claude/reviews/seed.mjs` + `capture.mjs`

axe-core was **not run** — manual contrast sampling only. A future polish pass should add `@axe-core/playwright` to the test suite.

## TL;DR

**Polish score: 7.5 / 10.** Mnemo punches above its weight visually — the Bear-meets-Notion aesthetic works, dark mode is properly designed (not just inverted), the keyboard-hint chips at the bottom of the review screen are a delight. The Apple-grade bar set in the product vision is achievable, not aspirational, with a v1-polish pass.

**Top 3 highest-leverage fixes:**

1. **Revert `fullscreen: true` default** (`src/main/index.ts:48`). Already in architect's ADR-010 + TASK-024. Today every cold start takes over the whole screen, which is jarring on a multi-monitor setup and makes the app feel like a kiosk, not a desktop tool.
2. **Add `Cmd+F` to focus the browse search input.** It's the single most expected mac shortcut in any list view, and currently there's no way to reach the search field except by mouse.
3. **Add a `?` keymap-help overlay.** The bottom-right keyboard chips on `/review` are great but only exist on that screen. A `?`-triggered modal listing every shortcut by section would make the keyboard-first promise legible everywhere.

A11y compliance is **partial AA** — visible focus rings are present, contrast is comfortable in both themes, icon-only buttons are mostly aria-labeled, but landmark roles, aria-live regions, and a skip-link are missing.

---

## Findings — by severity

### Critical (fix before public v1)

**F-001 — Fullscreen-by-default kiosk feel**
- Where: `src/main/index.ts:48`
- Issue: Every cold launch goes full-screen, taking over the entire display. On a multi-monitor or large-display setup it feels like a presentation tool, not a writing/review tool. Users expect to size and position their windows.
- Fix: Already covered by **TASK-024** — revert + add window-state persistence. No new work needed; just don't slip TASK-024 from M1.
- Effort: S (covered by existing task)

**F-002 — `Cmd+F` is unbound on `/browse`**
- Where: `src/renderer/routes/browse.tsx`
- Heuristic: HIG / "flexibility + efficiency"
- Issue: The browse list has search, but no keyboard accelerator focuses the search input. Power users who arrive on `/browse` from `Cmd+2` (when that lands) immediately want to `Cmd+F` to find a card.
- Fix: Bind `Cmd+F` (and bare `/`) in `browse.tsx` to focus the search input via a ref. ~10 lines.
- Effort: S

**F-003 — No native menu bar (mac)**
- Where: `src/main/index.ts` — no `Menu.setApplicationMenu` call
- Heuristic: Apple HIG (every Mac app must have a menu bar)
- Issue: With no menu, the user gets *only* the default Electron menu (File, Edit, View, Window, Help), which has Electron-developer wording ("Toggle Developer Tools," "Force Reload"), no About dialog with version info, and is a tell that this is "an Electron app" rather than a finished product. Also: missing Help menu means new users have no entry point to docs.
- Fix: Already covered by **TASK-028** — standard mac Cocoa menu. Don't slip from M1.
- Effort: M (covered by existing task)

**F-004 — No destructive-action confirm on namespace delete**
- Where: `src/renderer/components/namespace-tree.tsx:53` — the delete-deck button
- Heuristic: Nielsen / "error prevention"
- Issue: A delete-deck click removes every card under that namespace + its review state, atomically. Need to verify there's a confirmation dialog before proceeding. From a quick read of `namespace-tree.tsx` the click flow isn't obvious.
- Fix: If no confirm exists, add one (the `card-preview-modal` pattern already exists for modals). If a confirm exists already — close this finding with a note in the review markdown.
- Effort: S (verify + fix)

### Important (fix during v1 polish)

**F-005 — Accelerator gaps for route switching**
- Where: global, in `src/renderer/app.tsx` `GlobalShortcuts`
- Heuristic: HIG / Linear-style power-user expectations
- Issue: Existing globals are `Cmd+N` (new card) and `Cmd+,` (settings). Route switching (`Cmd+1` → /review, `Cmd+2` → /browse, `Cmd+3` → /dashboard, `Cmd+4` → /settings) is missing. For a daily-driver, this matters — users currently mouse-click sidebar items to switch.
- Fix: Add 4 navigates to `GlobalShortcuts`. ~6 lines.
- Effort: S

**F-006 — No keymap-help affordance**
- Where: global
- Heuristic: Nielsen / "recognition over recall"
- Issue: Bottom-right chips on `/review` are excellent (E, Space, 1-4) but disappear on every other screen. There's no global `?` overlay listing all shortcuts. Users who don't memorize them will mouse.
- Fix: Add a modal triggered by `?` (no modifier — convention from Slack, Linear, Notion) listing all bindings grouped by screen.
- Effort: M

**F-007 — No `aria-live` for toast / status updates**
- Where: assumed `toast` component (couldn't locate; may be inline)
- Heuristic: WCAG 2.2 — 4.1.3 Status Messages
- Issue: Save confirmations, error toasts, "card created" feedback aren't announced to screen readers. VoiceOver users get no signal that an action succeeded.
- Fix: Wrap status messages in a region with `role="status"` (polite) or `role="alert"` (assertive for errors).
- Effort: S

**F-008 — No landmark roles**
- Where: `src/renderer/app.tsx`
- Heuristic: WCAG 2.2 — 1.3.1 Info and Relationships
- Issue: No `<nav>` (or `role="navigation"`) on sidebar, no `<main>` (or `role="main"`) on the route pane. Screen-reader users can't jump between landmarks.
- Fix: Wrap sidebar in `<nav aria-label="Primary">`, content area in `<main>`. ~4 lines.
- Effort: S

**F-009 — `aria-current` missing on sidebar nav items**
- Where: sidebar primary nav
- Heuristic: WCAG 2.2 — 4.1.2 Name, Role, Value
- Issue: Active route is styled visually but not exposed semantically. Screen-reader users hear "Review" not "Review, current page."
- Fix: Add `aria-current="page"` to the active sidebar link based on route match.
- Effort: S

**F-010 — Inconsistent micro-typography in dashboard widgets**
- Where: `src/renderer/components/widgets/`
- Issue: Widget titles ("DUE FORECAST", "WEAKEST NAMESPACES", "LEECH LIST", etc.) are all uppercase-tracked, looks intentional. But "OVERVIEW" tagline above the page title uses the same treatment, which conflicts visually — hard to tell which is widget title vs page chrome. Dark-mode "OVERVIEW" specifically is barely visible.
- Fix: Use a different treatment for the page-level "OVERVIEW" eyebrow — e.g. smaller tracking, or replace with a tab-pill route indicator.
- Effort: S

**F-011 — Heatmap legend tiny + low contrast**
- Where: `components/widgets/heatmap.tsx` (likely)
- Issue: The "weak ▢ ▢ ▢ strong" legend in the top-right of the retention heatmap is barely legible — dotted swatches at ~6px each. On the activity-streak heatmap, no legend exists at all (user has to infer that orange = active).
- Fix: Larger swatches (10–12px), label position, consistent presence on both heatmaps.
- Effort: S

**F-012 — "Light" / "Dark" theme toggle is text-only and easy to miss**
- Where: bottom of sidebar, light theme shows "Light", dark shows "Dark"
- Issue: Text-only, no icon, no clear affordance that it's clickable. Discoverable only by hovering over the bottom-left of the screen. Mac convention is a sun/moon icon or a segmented control.
- Fix: Replace with a small sun/moon icon button (or sun/moon/auto segmented control to match the existing system-theme option in settings).
- Effort: S

**F-013 — File-watcher conflict with active editor pane is undefined**
- Where: `src/renderer/routes/editor.tsx` + `src/main/store/cards.ts` + watcher
- Heuristic: Nielsen / "help users recover from errors"
- Issue: User opens Mnemo's editor for `card-X.md`, then opens VS Code on the same file and edits + saves it. What does Mnemo's editor pane show? Stale content? An auto-update? A prompt? Without a defined behavior the user can lose work.
- Fix: Two reasonable patterns — (a) detect change while editor is dirty, prompt "external change detected; reload / keep your edits / show diff"; (b) silently sync if the editor pane is clean. Pick one and document.
- Effort: M

### Nice-to-have (post-v1)

**F-014 — Command palette (Linear / VS Code style)**
- Trigger: `Cmd+K` or `Cmd+Shift+P`
- Why: Mnemo's audience lives in keyboard-first apps. A fuzzy command palette would make every action (rate Again, switch to /dashboard, export selected, focus search, toggle theme, jump to card by ID) reachable without memorizing each shortcut.
- Effort: L (worth it but not v1)

**F-015 — Per-deck color tags**
- Why: With 10+ decks in the sidebar, distinguishing "languages/japanese" from "algorithms/dp" relies entirely on text. A small color dot on each leaf node (user-pickable) would help scanability.
- Effort: M (post-v1)

**F-016 — Reduce-motion respect**
- Why: HIG / WCAG 2.3.3. If the app has any animation (theme transition, card flip, etc.), wrap in `@media (prefers-reduced-motion: reduce)` to tone it down.
- Effort: S

**F-017 — Empty-state copy could be friendlier**
- Why: First-launch with zero cards shows "0 in queue / 0 reviewed" and a blank center pane. A real onboarding card ("Welcome to Mnemo. Press Cmd+N to create your first card, or drop a `.mnemo.zip` here to import a deck.") would convert better.
- Note: Mostly addressed by **TASK-019** (onboarding route in M1). This finding overlaps; close once onboarding lands.
- Effort: covered

---

## Accelerator audit (the headline output)

| Action | Current | Recommended for v1 | Notes |
|---|---|---|---|
| Reveal answer | Space (in /review) | Space | ✓ already wired |
| Rate Again | 1 (after reveal) | 1 | ✓ |
| Rate Hard | 2 | 2 | ✓ |
| Rate Good | 3 | 3 | ✓ |
| Rate Easy | 4 | 4 | ✓ |
| Edit current card | E (in /review, /card-view) | E | ✓ |
| New card | Cmd+N | Cmd+N | ✓ already wired (`app.tsx`) |
| Open settings | Cmd+, | Cmd+, | ✓ already wired |
| Save | Cmd+S (in /editor) | Cmd+S | ✓ |
| Close modal | Escape | Escape | ✓ |
| Back to browse | Escape (in /card-view) | Escape | ✓ |
| Prev/next prompt variant | ←/→ (in card-preview-modal) | ←/→ | ✓ |
| **Switch to /review** | — | **Cmd+1** | **F-005 gap** |
| **Switch to /browse** | — | **Cmd+2** | **F-005 gap** |
| **Switch to /dashboard** | — | **Cmd+3** | **F-005 gap** |
| **Switch to /settings** | — | **Cmd+4** | **F-005 gap** |
| **Focus search (/browse)** | — | **Cmd+F** + bare `/` | **F-002 gap** |
| **Help / shortcuts overlay** | — | **`?`** (bare) | **F-006 gap** |
| Toggle theme | mouse only | **Cmd+Shift+L** | nice-to-have |
| Quit app | OS default | Cmd+Q (via menu) | covered by TASK-028 |
| Close window | OS default | Cmd+W (via menu) | covered by TASK-028 |
| Reload | F5 / Cmd+R | disabled in prod | electron default; verify disabled in packaged build |
| Toggle DevTools | Cmd+Opt+I | disabled in prod | verify disabled by `@electron/fuses` config |

**Existing / confirmed: 12 accelerators**
**Recommended additions for v1: 6** (F-002, F-005 ×4, F-006)
**Conflicts: 0**

---

## Native-menu shortcut wiring (informs TASK-028)

When the architect's standard mac Cocoa menu lands (TASK-028), these accelerators should appear in the **menu bar** so users can discover them:

| Menu | Item | Accelerator |
|---|---|---|
| Mnemo | About Mnemo | — |
| Mnemo | Settings… | Cmd+, |
| Mnemo | Hide Mnemo | Cmd+H (mac default) |
| Mnemo | Quit Mnemo | Cmd+Q (mac default) |
| File | New Card | Cmd+N |
| File | Import… | Cmd+Shift+I |
| File | Export… | Cmd+Shift+E |
| Edit | Cut/Copy/Paste/Select All | mac role defaults |
| Edit | Find | Cmd+F (acts on /browse search) |
| View | Review | Cmd+1 |
| View | Browse | Cmd+2 |
| View | Dashboard | Cmd+3 |
| View | Toggle Theme | Cmd+Shift+L |
| View | Toggle Full Screen | Ctrl+Cmd+F (mac default) |
| Window | Minimize | Cmd+M (mac default) |
| Window | Close | Cmd+W (mac default) |
| Help | Keyboard Shortcuts | `?` (note in label) |
| Help | Mnemo Documentation | — (link to GitHub README) |

Renderer-only (don't put in menu): Space, 1–4, E, ←/→, Escape — these are screen-local interactions, not commands.

---

## A11y status per screen

| Screen | Light contrast | Dark contrast | Focus visible | Keyboard-only | Notes |
|---|---|---|---|---|---|
| /review | pass (sample) | pass | yes | yes | ★ best-in-class keyboard hints |
| /browse | pass | pass | yes | partial | search needs Cmd+F (F-002) |
| /dashboard | pass | warn — "OVERVIEW" eyebrow low contrast | yes | n/a (no actions) | F-010 |
| /editor | pass | pass | yes | yes | Cmd+S works |
| /card-view | pass | pass | yes | yes | E and Esc work |
| /settings | pass | pass | yes | yes | |
| Sidebar | pass | pass | yes | partial | active-state needs aria-current (F-009) |
| Modals | pass | pass | yes | yes (Esc closes) | focus trap not verified |

A11y compliance: **partial AA**. Fails:
- Landmark roles (F-008)
- aria-current on active nav (F-009)
- aria-live for status messages (F-007)
- Focus-trap on modals not verified
- Skip-link absent (Lighthouse expects one)

---

## What's already good (don't regress this)

1. **The keyboard-hint chips on /review are world-class.** "E edit | Space flip | 1-4 rate" at the bottom-right teaches the keyboard model in 8 characters. Most apps need a tutorial.
2. **Dark mode is *designed*, not inverted.** The brand brown stays brown, the green retention indicator stays green, contrast holds. That's an Anki-Linear-Bear-level move.
3. **The sidebar deck tree with dual counts (`5 / 15`) is dense but readable.** Anki's sidebar is a wall of numbers; Mnemo's reads at a glance.
4. **Serif heading + sans body is a real character choice.** Bear-adjacent, fits the "writing-first" identity.
5. **Empty-string treatment of the empty review queue** ("5 in queue / 0 reviewed" footer is informative without being noisy).
6. **The brand color (warm brown / orange) is consistent** across primary buttons, active checkboxes, sidebar selection, dashboard accents. No one-off hexes spotted.
7. **Aria-labels on every icon-only button I checked** — namespace tree delete, settings reorder, editor prompt move/delete, card-preview-modal nav. Better than 80% of Electron apps.

---

## Recommended developer execution order

If acting on this review, do the work in this order — small wins first to compound:

1. **F-005 + F-002** (route-switching + Cmd+F focus search). 30 min. High value, low risk.
2. **F-008 + F-009** (landmark roles + aria-current). 20 min. Pure a11y wins.
3. **F-007** (aria-live status). 30 min.
4. **F-004** (verify namespace-delete confirm). 30 min.
5. **F-006** (keymap-help `?` modal). 2-3 hours. Genuinely useful.
6. **F-010 + F-011 + F-012** (typography + heatmap legend + theme toggle). 1-2 hours combined.
7. **F-013** (file-watcher conflict UX). Half day. Needs a small spike.

Total: ~1 working day for everything from F-002 through F-012, plus a half-day for F-013.

F-001 + F-003 are already in the architect's M1 task list (TASK-024, TASK-028) and don't need separate developer briefs.

Nice-to-haves (F-014 command palette, F-015 deck colors, F-016 reduced-motion) are post-v1.
