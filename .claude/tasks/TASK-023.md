# TASK-023 — Revert `fullscreen: true` default

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Stop opening the app fullscreen on every launch. Fullscreen-by-default is a power-user surprise; the standard idiom is windowed-with-restore.

**Verifies:** prerequisite for TVC-D1 (window restore size). Trace: VC-4.

## Out of scope

- Window-state persistence (TASK-024).
- `lastRoute` persistence (TASK-025).

## Plan

- In `src/main/index.ts`, change the `BrowserWindow` constructor: remove `fullscreen: true`. Default to `width: 1280, height: 800`. The window-state module (TASK-024) takes over the bounds question once it lands; until then, fall back to centered defaults.
- Verify the `electron-debug` skill still launches a windowed instance.

## Acceptance

- Fresh launch: app opens windowed at 1280×800, centered on the primary display.
- Cmd-Ctrl-F still toggles fullscreen on user demand.

## Notes

- This is a one-line change but it has a TVC trace and a real product impact, so it gets a dedicated task rather than getting bundled into TASK-024.

