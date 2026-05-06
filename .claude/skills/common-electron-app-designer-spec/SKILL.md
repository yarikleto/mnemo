---
name: common-electron-app-designer-spec
description: Designer extracts a desktop design specification from the approved HTML prototype — design tokens, component inventory, screen map with visual acceptance criteria per screen, plus the desktop-specific artefacts every Electron app needs on day one — a **menu map** (per-platform application menu), a **shortcut map** (every accelerator with its `CmdOrCtrl` form and OS-chord conflicts), and a window-state spec (single vs SDI vs tabbed; persistence; multi-monitor restore). Use after the prototype is approved.
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent, mcp__claude_ai_Excalidraw__read_me, mcp__claude_ai_Excalidraw__create_view, mcp__claude_ai_Excalidraw__export_to_excalidraw
argument-hint: "[--update to revise existing spec]"
---

# Electron Design Spec — From Prototype to Implementation Blueprint

You are the CEO. The prototype is approved by the client. Before any code is written, the **designer** must extract a design specification — the bridge between "how it looks/feels" (prototype) and "how to build it" (tasks).

This is a desktop-app team. The spec covers a desktop UI: tokens, components, screens, menus per platform, accelerators per platform, window-state behavior, and (if defined) dark-mode + per-platform window chrome.

## Step 1: Verify inputs

Check that these files exist:
- `.claude/prototypes/README.md` — prototype index
- Latest approved HTML prototype (`.claude/prototypes/v{N}/index.html`)
- `.claude/product-vision.md` — for context (target platforms, app lifecycle mode, window architecture flag)

If `$ARGUMENTS` contains `--update`, read existing `.claude/design-spec.md`, `.claude/menu-map.md`, `.claude/shortcut-map.md` and revise.

## Step 2: Brief the designer

Send **designer** with this brief:

> Read the latest approved prototype from `.claude/prototypes/`.
> Read `.claude/product-vision.md` for target platforms and the window-architecture flag.
> Open the HTML file and analyze it completely — every screen, every component, every menu, every accelerator hint, every color, every spacing value.
>
> Produce THREE artefacts:
> - `.claude/design-spec.md` — tokens + components + screen map + window-state spec
> - `.claude/menu-map.md` — application menu per platform (mac mandatory items, Win/Linux in-window or GNOME header bar)
> - `.claude/shortcut-map.md` — every accelerator in `CmdOrCtrl` form, with conflicts called out
>
> Use the structures below. Extract EXACT values from the prototype HTML/CSS — don't invent. Skip sections that don't apply (no dark mode? skip it).
>
> ## Artefact 1: `.claude/design-spec.md`
>
> ````markdown
> # Design Specification
> > Extracted from prototype v{N} — {date}
> > Prototype: `.claude/prototypes/v{N}/index.html`
>
> ## 1. Design Tokens (CSS custom properties)
>
> ### Colors (semantic)
> | Token | Light | Dark | Usage |
> |-------|-------|------|-------|
> | `--color-bg` | `#ffffff` | `#0a0a0a` | Window background |
> | `--color-bg-surface` | `#f9fafb` | `#171717` | Cards, sidebars |
> | `--color-bg-elevated` | `#ffffff` | `#1f1f1f` | Popovers, dialogs |
> | `--color-text` | `#0a0a0a` | `#ededed` | Body text |
> | `--color-text-muted` | `#6b7280` | `#a1a1aa` | Secondary text |
> | `--color-border` | `#e5e7eb` | `#262626` | Borders, dividers |
> | `--color-accent` | `#3b82f6` | `#60a5fa` | Primary CTAs, focus rings |
> | `--color-titlebar-bg` | `#f3f4f6` | `#1f1f1f` | Custom title bar surface (if used) |
> | `--color-success` | `#10b981` | `#34d399` | Success states |
> | `--color-warning` | `#f59e0b` | `#fbbf24` | Warnings |
> | `--color-danger` | `#ef4444` | `#f87171` | Errors |
>
> Pair these with `nativeTheme.shouldUseDarkColors` so the renderer flips on `nativeTheme` `updated` event.
>
> ### Typography
>
> Default to system-font stacks unless the prototype overrides:
> | Token | Value | Usage |
> |-------|-------|-------|
> | `--font-system` | `-apple-system, 'Segoe UI Variable', Cantarell, 'Adwaita Sans', system-ui, sans-serif` | All text |
> | `--font-mono` | `ui-monospace, 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace` | Code, IDs |
> | `--text-xs` | `0.75rem` (12px) | Captions, status bar |
> | `--text-sm` | `0.8125rem` (13px) | macOS body default |
> | `--text-base` | `0.875rem` (14px) | Win/Linux body default |
> | `--text-lg` | `1rem` (16px) | Section headers |
> | `--text-xl` | `1.125rem` (18px) | Window titles |
> | `--font-weight-normal` | `400` | Body |
> | `--font-weight-medium` | `500` | Labels, buttons |
> | `--font-weight-semibold` | `600` | Headings |
>
> Reasoning: native system fonts beat custom web fonts on desktop — they avoid licensing, cold-start FOUT, and look "right" per OS.
>
> ### Spacing (8px grid, rem-based)
> | Token | Value | Usage |
> |-------|-------|-------|
> | `--space-1` | `0.25rem` (4px) | Tight: icon-to-label |
> | `--space-2` | `0.5rem` (8px) | Related elements |
> | `--space-3` | `0.75rem` (12px) | Form fields |
> | `--space-4` | `1rem` (16px) | Between groups |
> | `--space-6` | `1.5rem` (24px) | Between sections |
> | `--space-8` | `2rem` (32px) | Major breaks |
>
> ### Borders, radius, shadow, motion
> | Token | Value | Usage |
> |-------|-------|-------|
> | `--radius-sm` | `0.25rem` | Inputs, badges |
> | `--radius-md` | `0.5rem` | Buttons, small cards |
> | `--radius-lg` | `0.75rem` | Cards, dialogs |
> | `--shadow-sm` | `0 1px 2px rgb(0 0 0 / 0.05)` | Subtle elevation |
> | `--shadow-md` | `0 4px 6px rgb(0 0 0 / 0.07)` | Popovers, dropdowns |
> | `--shadow-lg` | `0 10px 15px rgb(0 0 0 / 0.1)` | Dialogs |
> | `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default |
> | `--duration-fast` | `120ms` | Hovers |
> | `--duration-base` | `180ms` | Most transitions |
>
> All transitions skipped under `@media (prefers-reduced-motion: reduce)`.
> Click targets ≥24px (Fluent) / ≥28pt (HIG). Touch targets ≥44px on touch laptops.
>
> ## 2. Window Chrome (per platform)
>
> Document for each platform:
>
> ### macOS
> - **Traffic lights:** native, top-left. Frame: `titleBarStyle: 'hiddenInset'` (or `'default'` if not customizing).
> - **Title:** centered or left, system font.
> - **Vibrancy:** {none / sidebar / under-window — pick one}.
>
> ### Windows
> - **Caption controls:** native, top-right. Frame: standard or `titleBarOverlay` if using a custom title bar with Snap Layouts (Win11).
> - **Mica / acrylic:** {none / mica — Win11 only}.
> - **Drag region:** `-webkit-app-region: drag` on the title-bar surface; non-draggable interactive controls inside need `-webkit-app-region: no-drag`.
>
> ### Linux (GNOME)
> - **Header bar:** primary `…` menu + window controls top-right. Frame: standard CSD via `frame: false` only if shipping a real header bar.
> - **No menu bar by default** (modern GNOME convention) — surface menus via the `…` button.
>
> ## 3. Component inventory
>
> ### Buttons
> | Variant | Style | Usage |
> |---------|-------|-------|
> | Primary | `bg-accent text-white rounded-md font-medium px-3 py-1.5` | Default action in dialogs |
> | Secondary | `border border-border text-text rounded-md px-3 py-1.5` | Secondary action |
> | Destructive | `bg-danger text-white rounded-md` | Delete / remove |
> | Ghost | `text-accent hover:bg-accent/10` | Tertiary |
> | Icon-only | square 28×28, accessible label required | Toolbars |
>
> ### Inputs & form controls
> { Same shape as web — text inputs, selects, checkboxes, radios, textareas with focus rings }
>
> ### Cards / panels / sidebars / status bar
> { describe each — surface, elevated, interactive }
>
> ### Native dialogs (shown via `dialog.showOpenDialog` / `showSaveDialog` / `showMessageBox`)
> { documented as system dialogs — no in-app rendering }
>
> ### Overlays
> { Modal / Popover / Toast — Esc dismisses every modal; Enter activates default }
>
> ### Feedback
> { Empty / Loading (skeleton) / Error / Success — describe each }
>
> ## 4. Screen map
>
> For EACH screen / window in the prototype:
>
> ### Screen: {name} (e.g., "Editor", "Preferences", "Welcome")
> **Window kind:** {primary / preferences / dialog}
> **Prototype location:** Screen #{N} in `.claude/prototypes/v{N}/index.html`
> **Purpose:** {what the user does here}
> **Layout:** {e.g., "sidebar left 240px + main editor pane"}
> **Window state:** {persisted bounds / fixed size / centered modal}
>
> **Components used:**
> - { component list }
>
> **Visual acceptance criteria:**
> - [ ] Window opens with `ready-to-show` + `backgroundColor: var(--color-bg)` — no white flash
> - [ ] Sidebar w-60 with section labels and nav items
> - [ ] Active nav item: `bg-accent/10 text-accent`, 2px left border accent
> - [ ] Title bar font + size matches platform default (system stack)
> - [ ] Loading: skeleton placeholders matching final layout
> - [ ] Error: inline banner with retry action
> - [ ] Empty state: centered illustration + headline + primary CTA
>
> ### Screen: {next}
> ...
>
> ## 5. Interaction states
>
> - **Hover** — color/shadow shift, 120ms ease-out
> - **Focus** — visible `:focus-visible` ring, never `outline: none` without replacement (a11y red line)
> - **Active / pressed** — slightly darker / scale-95
> - **Disabled** — `opacity-50 cursor-not-allowed`, no hover effect
> - **Loading** — skeleton screens preserve layout
> - **Error** — inline message below field, `text-danger`
> - **Empty** — illustration + headline + supporting text + CTA
> - **Success** — toast top-right, auto-dismiss 3-4s
>
> ## 6. Window-state spec
>
> The architect picks the architecture, but document the user-facing behavior:
>
> - **Architecture:** {single-window | SDI (one window per document) | tabbed | multi-window}
> - **Bounds persistence:** save `{ x, y, width, height, isMaximized, displayId }` on `close` and `move/resize` (debounced 250ms) to electron-store. Restore on next launch.
> - **Multi-monitor restore:** clamp restored bounds to a currently-visible display via `screen.getAllDisplays()`. If the saved display is gone, center on the primary display.
> - **Minimum size:** {e.g., 720×480}.
> - **Quit-with-unsaved:** Cmd+Q (mac) / Alt+F4 (Win) / Ctrl+Q (Linux) shows a confirm dialog if any document is dirty.
>
> ## 7. Accessibility commitments
>
> - WCAG AA contrast on all text and UI components
> - Visible `:focus-visible` ring on every interactive element
> - Click targets ≥24px (Fluent) / ≥28pt (HIG)
> - Respect `prefers-reduced-motion`
> - Color is never the only signal (pair with icon/label/shape)
> - All form inputs have associated `<label>`; errors are `aria-describedby` linked
> - Native menus are NOT in DOM — manual-qa verifies VoiceOver / Narrator / Orca paths
>
> ## 8. Dark mode
>
> Toggle: follow `nativeTheme.shouldUseDarkColors`; flip on `nativeTheme` `updated` event mid-session.
> All color tokens have a dark counterpart (Section 1).
> Shadows softened or removed in dark; depth via layered surface tokens.
> ````
>
> ## Artefact 2: `.claude/menu-map.md`
>
> ````markdown
> # Menu Map
> > Extracted from prototype v{N} — {date}
>
> ## macOS (mandatory — `Menu.setApplicationMenu` is required)
>
> Without `Menu.setApplicationMenu` mac shows the binary name. Stock items use `role:` strings.
>
> | Menu | Items |
> |------|-------|
> | `{App Name}` | About `{App Name}` (`role: about`) — Preferences… (Cmd+,) — Services (`role: services`) — Hide `{App Name}` (Cmd+H, `role: hide`) — Hide Others (Cmd+Alt+H, `role: hideOthers`) — Show All (`role: unhide`) — Quit `{App Name}` (Cmd+Q, `role: quit`) |
> | File | New (Cmd+N) — Open… (Cmd+O) — Open Recent (`role: recentDocuments`) — Close Window (Cmd+W, `role: close`) — Save (Cmd+S) — Save As… (Cmd+Shift+S) |
> | Edit | Undo (Cmd+Z, `role: undo`) — Redo (Cmd+Shift+Z, `role: redo`) — Cut (Cmd+X, `role: cut`) — Copy (Cmd+C, `role: copy`) — Paste (Cmd+V, `role: paste`) — Select All (Cmd+A, `role: selectAll`) |
> | View | Toggle Full Screen (Ctrl+Cmd+F, `role: togglefullscreen`) — Toggle Developer Tools (Cmd+Alt+I, `role: toggleDevTools`) — {project items} |
> | Window | Minimize (Cmd+M, `role: minimize`) — Zoom (`role: zoom`) — Bring All to Front (`role: front`) |
> | Help | `{App Name}` Help — {project links} |
>
> ## Windows / Linux (in-window menu OR GNOME header bar `…` menu)
>
> Pick ONE pattern from the prototype:
> - **In-window menu bar** (Word / Notepad style) — render via `Menu.setApplicationMenu` with the menu shown attached to the window
> - **Hamburger / `…` menu** (GNOME / VS Code style) — surfaced by a button in the title bar; render via `Menu.popup`
>
> ### Items (any platform that uses the in-window pattern)
>
> | Menu | Items |
> |------|-------|
> | File | New (Ctrl+N) — Open… (Ctrl+O) — Recent — Close Window (Ctrl+W) — Save (Ctrl+S) — Save As… (Ctrl+Shift+S) — Exit (Alt+F4 Win / Ctrl+Q Linux) |
> | Edit | Undo (Ctrl+Z) — Redo (Ctrl+Y Win / Ctrl+Shift+Z Linux) — Cut (Ctrl+X) — Copy (Ctrl+C) — Paste (Ctrl+V) — Select All (Ctrl+A) |
> | View | Toggle Full Screen (F11) — Toggle DevTools (Ctrl+Shift+I) — {project items} |
> | Help | Documentation — About `{App Name}` |
>
> ## Cross-platform rules
>
> - Never hardcode `Cmd+` or `Ctrl+` — always use `CmdOrCtrl` in `accelerator:` strings.
> - Use `role:` for stock items so the OS handles localization and a11y.
> - Context menus: `Menu.popup({ window })` — no DOM-rendered right-click menus on text/inputs unless the prototype demands it.
> - Tray icon: ONLY if the app is background-resident (per product vision). Foreground apps don't get a tray.
> ````
>
> ## Artefact 3: `.claude/shortcut-map.md`
>
> ````markdown
> # Shortcut Map
> > Extracted from prototype v{N} — {date}
>
> Every accelerator in the app, with the `CmdOrCtrl` form Electron expects.
>
> | Action | Accelerator (Electron) | macOS displays | Windows / Linux displays | OS-chord conflicts to avoid |
> |--------|------------------------|----------------|--------------------------|----------------------------|
> | New | `CmdOrCtrl+N` | `⌘N` | `Ctrl+N` | — |
> | Open | `CmdOrCtrl+O` | `⌘O` | `Ctrl+O` | — |
> | Save | `CmdOrCtrl+S` | `⌘S` | `Ctrl+S` | — |
> | Save As | `CmdOrCtrl+Shift+S` | `⌘⇧S` | `Ctrl+Shift+S` | — |
> | Quit | `CmdOrCtrl+Q` | `⌘Q` | `Ctrl+Q` (Linux); Win uses Alt+F4 | — |
> | Find | `CmdOrCtrl+F` | `⌘F` | `Ctrl+F` | — |
> | Find Next | `CmdOrCtrl+G` | `⌘G` | `Ctrl+G` | — |
> | Toggle DevTools | `CmdOrCtrl+Alt+I` | `⌘⌥I` | `Ctrl+Shift+I` (mapped) | — |
> | Toggle Full Screen | `Ctrl+Cmd+F` (mac) / `F11` (Win/Linux) | `⌃⌘F` | `F11` | — |
> | Command Palette | `CmdOrCtrl+K` (or `CmdOrCtrl+Shift+P`) | `⌘K` | `Ctrl+K` | — |
> | Switch Tab Next | `Ctrl+Tab` (cross-platform) | `⌃⇥` | `Ctrl+Tab` | — |
>
> ## OS chords NEVER to shadow
>
> - **macOS:** `Cmd+H` (hide — `role: hide` is fine, custom is not), `Cmd+Tab`, `Cmd+Space`, `Cmd+Shift+3` / `4` / `5`.
> - **Windows:** `Win+L`, `Win+D`, `Win+Tab`, `Ctrl+Alt+Del`, `Alt+Tab`, `Alt+F4`.
> - **Linux:** `Ctrl+Alt+T` (terminal), `Super+L`, `Alt+Tab`.
>
> ## globalShortcut
>
> `globalShortcut.register(...)` is ONLY for media keys / launcher-style apps. Almost always wrong otherwise — local accelerators via menu items are the right tool.
>
> ## Conflicts flagged in this prototype
>
> { list any prototype shortcut that overlaps a system chord above; recommend an alternative }
> ````
>
> **Rules:**
> - Extract EXACT values from the prototype HTML/CSS — don't invent.
> - Every token must be actually used in the prototype.
> - Visual acceptance criteria per screen are CRITICAL — reviewer and designer verify against these.
> - Component inventory must cover every distinct UI element in the prototype.
> - Use `CmdOrCtrl`, never `Cmd+` or `Ctrl+` literally in the shortcut map.
> - macOS App Menu is mandatory — without `Menu.setApplicationMenu` mac shows the binary name.
> - Tray icon ONLY for background-resident apps (per product vision).
> - Skip sections that don't apply.

## Step 3: Review

Read all three artefacts. Check:
- Tokens extracted from the actual prototype (not invented)?
- Component inventory matches what's visible?
- Every screen has visual acceptance criteria?
- Window-state spec covers single/SDI/tabbed and multi-monitor restore?
- macOS App Menu has all mandatory items?
- Win/Linux menu pattern picked (in-window OR `…` button) — not "both"?
- Shortcut map uses `CmdOrCtrl` everywhere, not literal `Cmd+`/`Ctrl+`?
- OS-chord conflicts called out?
- Tray icon only present if vision says background-resident?

If gaps, send designer back.

## Step 4: Update CEO brain

Update `.claude/ceo-brain.md`:
- "Key Decisions Log" → design spec created, {N} screens, {N} components, menu map per platform, {M} accelerators, dark mode {yes/no}

## Step 5: Present to client

> "The designer extracted a full design spec from the approved prototype — {N} screens, {N} components, all with exact tokens, plus a per-platform menu map and shortcut map.
> This means the developer won't guess at menu items or accelerators, and the reviewer can verify every shortcut is consistent across mac / Windows / Linux."
