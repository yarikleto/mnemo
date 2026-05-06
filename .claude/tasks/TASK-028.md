# TASK-028 — `src/main/menu.ts`: macOS Cocoa menu; null on Windows / Linux

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Ship a standard macOS application menu so Mac users get the platform-native About / Preferences / Hide / Quit accelerators, and explicitly suppress the default Electron menu on Windows / Linux (which duplicates the renderer-side UI).

**Verifies:** prerequisite for VC-1 ("feels native on macOS") + supports the polished feel that makes the app a 5-star MVP.

## Out of scope

- Custom menu items dispatching to renderer (TASK-029).
- Renderer subscriber wiring (TASK-030).
- Tray menu (v2).

## Plan

- New `src/main/menu.ts` exporting `installAppMenu(win)`. Behaviour:
  - On `process.platform === 'darwin'`: build the template per ADR-009 and call `Menu.setApplicationMenu(Menu.buildFromTemplate(template))`. Menus: Mnemo, File, Edit, View, Window, Help. Use `role:` for stock items so accelerators are platform-correct.
  - On any other platform: `Menu.setApplicationMenu(null)` to suppress the Electron default Edit/View bar that otherwise appears in window chrome.
- Stock menu structure (verbatim from ADR-009):
  - Mnemo: About / sep / Preferences (Cmd-, → custom) / sep / Services / sep / Hide / Hide Others / Show All / sep / Quit.
  - File: New Card (Cmd-N → custom) / Open Vault Folder… (custom) / sep / Import… (custom) / Export Selected… (custom) / sep / Close Window.
  - Edit: Undo / Redo / Cut / Copy / Paste / Select All / Find (Cmd-F → custom).
  - View: Review (Cmd-1 → custom) / Browse (Cmd-2 → custom) / Dashboard (Cmd-3 → custom) / Settings (Cmd-, → custom — duplicate of Preferences) / sep / Toggle Theme (Cmd-Shift-T → custom) / sep / Reload (dev only) / Toggle DevTools (dev only) / sep / Toggle Full Screen.
  - Window: Minimize / Zoom / sep / Bring All to Front.
  - Help: Mnemo on GitHub (`shell.openExternal`) / Report an Issue… (`shell.openExternal`) / sep / Copy Diagnostics (TASK-032).
- Call `installAppMenu(win)` from `app.whenReady().then(...)` after `createWindow` resolves.

## Acceptance

- macOS: launch the dev build, the menu bar shows Mnemo / File / Edit / View / Window / Help.
- Windows / Linux: launch the dev build, no menu bar in the window chrome.
- Cmd-Q quits via the OS-bound `role: 'quit'`.

## Notes

- `role:` strings (`about`, `services`, `hide`, `hideOthers`, `unhide`, `quit`, `close`, `minimize`, `zoom`, `front`, `togglefullscreen`, `reload`, `toggleDevTools`, `undo`, `redo`, `cut`, `copy`, `paste`, `selectAll`) handle accelerators and behaviour platform-correctly. We override accelerators only for the custom verbs.

