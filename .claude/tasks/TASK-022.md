# TASK-022 — `/onboarding` route: single screen, two buttons

**Milestone:** M1
**Owner:** Developer (designer-light: small targeted ask per ADR-008)
**Size:** S
**Depends on:** TASK-019, TASK-020, TASK-021

## Goal

Build the actual first-run screen the user sees when they launch Mnemo for the first time. One screen, one paragraph of copy, two buttons: "Use the default" and "Choose a folder…". Lands the user on `/review` once committed.

**Verifies:** TVC-B1 (no-config → /onboarding), TVC-B3 (folder picker round-trip). Trace: VC-2.

## Out of scope

- Re-onboarding from settings (kept simple: a small "Change vault…" button reusing the same IPCs in `/settings`).

## Plan

- Add `src/renderer/routes/onboarding.tsx`. Layout:
  - Title: "Welcome to Mnemo."
  - Paragraph: "Mnemo stores your cards as plain markdown files in a folder you choose. You can edit them in any editor, version-control with git, and share them as a single zip. Pick a folder to start."
  - Button 1 (primary): "Use the default" with subtitle "(`~/Documents/mnemo`)". Calls `completeOnboarding({ rootPath: <default> })` where `<default>` is computed once in main and exposed via a small new `getDefaultVaultPath` IPC OR via an existing `getConfig` field (cheaper: extend `Config` with a transient `defaultVaultPath` field that main fills on each `getConfig` call).
  - Button 2 (secondary): "Choose a folder…". Calls `pickVaultFolder()`, then on success calls `completeOnboarding({ rootPath })`.
  - On either success path, navigate to `/review` and dismiss the onboarding component.
- Add `Route path="/onboarding" element={<OnboardingRoute />}` to `src/renderer/app.tsx`.
- Hide `Sidebar` when the current location is `/onboarding` (the sidebar shows the namespace tree; without a vault, it has nothing to render).
- Update `useAppStore.init`: after loading config, if `!onboardedAt || !rootPath`, replace navigation to `/onboarding`. Otherwise, replay `lastRoute` (TASK-025) or land on `/review`.
- Style: Tailwind, dark/light theme aware, matches existing visual language (no new icons, no new fonts).
- A small "Change vault…" button in `/settings` reuses the same two IPCs. Pre-confirm with a dialog: "Switching vaults — Mnemo will not migrate your existing cards. The new folder must be a vault you've already populated, or a new empty one." (The existing `Settings` route adds the button; that is in-scope for this task as a small additive.)

## Acceptance

- Playwright e2e: launching with a fresh `userData/` shows `/onboarding`. Clicking "Use the default" creates the dirs and lands on `/review`. (Implements TVC-B1 + TVC-B2; TVC-B3 needs a folder-picker mock — covered in TASK-035.)
- Designer review: the screen matches Mnemo's voice and dark/light themes. (One-shot review; expected zero rework.)

## Notes

- The onboarding screen is a *route*, not a modal. It survives navigation, supports the back arrow, and is reachable from settings. Modal-as-onboarding is rejected in ADR-008.

