# TASK-015 — Renderer "update ready" banner + settings toggle

**Milestone:** M0
**Owner:** Developer
**Size:** S
**Depends on:** TASK-014

## Goal

Surface the update-ready event from main as a non-modal banner the user can act on at their leisure ("Restart now" / "Later"), plus a toggle in `/settings` for `autoUpdate.enabled`. No silent surprise restarts.

**Verifies:** TVC-E2/E3 (user-driven side of the round-trip). Trace: VC-5.

## Out of scope

- The IPC contract / polling logic (TASK-014).
- The actual auto-update e2e test (TASK-018).

## Plan

- Extend `Api` (`src/shared/api.ts`) with an `onUpdateReady(cb: (info: { version: string }) => void): () => void` subscriber and a `restartToInstall(): Promise<ApiResult<void>>` verb. Mirror in `src/preload/index.ts`. (TASK-014 owns the main-side handler; this task adds the renderer-facing surface.)
- Build a `<UpdateBanner>` component rendered by `App` above the routes when an `update:ready` arrives. Banner content: "Mnemo X.Y.Z is ready — restart to apply." Two buttons: Restart now, Later. Banner persists across route changes until dismissed (Zustand store flag).
- In `/settings`, add a toggle row "Automatic updates" wired to `Config.autoUpdate.enabled`. Default `true`. Disable warning copy: "Mnemo will stop checking for new versions; you'll need to download updates manually from GitHub." (Helps the maintainer if a buggy updater needs to be temporarily disabled.)
- Visual style: banner matches existing dark/light theme. No new icons. Keep it boring — a thin colored stripe with two text buttons.

## Acceptance

- When main fires `update:ready`, the banner appears within one render frame.
- Clicking "Restart now" calls `restartToInstall`, the app relaunches into the new version (verified end-to-end in TASK-018).
- Toggling "Automatic updates" off and reopening the app prevents the updater from polling on next launch.

## Notes

- "Later" simply hides the banner for the session — does not silence future versions. On next launch, polling resumes from scratch.

