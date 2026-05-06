# TASK-029 — Custom menu items dispatch `menu:<verb>` push events

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-028

## Goal

For the menu items that don't have an OS-native role, fire a typed push event the renderer can listen to. This is how Cmd-N (new card), Cmd-, (settings), Cmd-1/2/3 (route nav), Cmd-Shift-T (theme), Cmd-F (find), Import…, Export Selected… all reach the renderer's existing handlers.

**Verifies:** prerequisite for the menu user experience covered by TASK-030.

## Out of scope

- Renderer subscriber (TASK-030).

## Plan

- For every custom menu item built in TASK-028, the `click` handler calls `win.webContents.send('menu:<verb>', payload?)`. Verbs:
  - `menu:open-settings`
  - `menu:new-card`
  - `menu:nav-review`, `menu:nav-browse`, `menu:nav-dashboard`
  - `menu:toggle-theme`
  - `menu:find`
  - `menu:import`, `menu:export`
  - `menu:open-vault-folder` (calls `pickVaultFolder` + `completeOnboarding` re-onboarding flow under the hood — same IPCs from TASK-019/020).
  - `menu:copy-diagnostics` (paired with TASK-032).
- The Help → "Mnemo on GitHub" / "Report an Issue…" items call `shell.openExternal` directly in main, no renderer dispatch needed.
- Add a small wrapper helper `dispatch(verb)` in `menu.ts` to keep handlers terse.

## Acceptance

- Triggering a custom menu item from the macOS menu bar fires a `menu:<verb>` IPC event observable in the renderer (verified via the `electron-debug` skill IPC capture).

## Notes

- Channel naming follows the existing convention (`card-added`, `card-changed`). Reusing `:` as a separator is a deliberate departure for menu events to keep them visually distinct from data events; if the existing convention is `-` (hyphen, no colon), match that. (The system-design's ADR-009 uses `menu:<verb>` explicitly — keep it.)

