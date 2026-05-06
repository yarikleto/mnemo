# TASK-025 — `lastRoute` persistence: replay last visited route on launch

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** TASK-020 (Config schema gains `lastRoute`)

## Goal

After the user quits and relaunches, take them back to the route they were on (e.g. `/dashboard` instead of always `/review`). Closes the third leg of VC-4.

**Verifies:** TVC-D3 (last-route replay). Trace: VC-4.

## Out of scope

- Window bounds (TASK-024) — different file, different concern.

## Plan

- `lastRoute: string | null` field on `Config` is already added in TASK-020.
- Renderer side: in `src/renderer/app.tsx`, subscribe to `useLocation()` (react-router) and on every navigation call `window.api.updateConfig({ lastRoute: location.pathname })`. Debounce in the Zustand store so a rapid sequence of route changes only writes once (~200 ms).
- `useAppStore.init`: after loading config, before redirecting to `/review`:
  - If `onboardedAt && rootPath && lastRoute && lastRoute !== '/onboarding'` → `navigate(lastRoute, { replace: true })`.
  - If `!onboardedAt` → `/onboarding`.
  - Otherwise → `/review`.
- Skip persisting `/onboarding` (we never want to land there if the user actually onboarded).

## Acceptance

- Manual: visit `/dashboard`, quit, relaunch — app lands on `/dashboard`.
- Manual: complete onboarding, quit before navigating elsewhere, relaunch — app lands on `/review` (default), not `/onboarding`.

## Notes

- The route is small enough that we sit inside `Config` rather than introducing a third state file. Cost: every route change writes config; mitigated by the Zustand debounce.

