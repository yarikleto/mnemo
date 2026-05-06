# TASK-003 — GitHub Actions secrets handoff

**Milestone:** M0
**Owner:** DevOps (handoff guide) → Client (paste into Settings → Secrets)
**Size:** S
**Status:** **BLOCKED on client action**
**Depends on:** TASK-002

## Goal

Move the five Apple secrets from the client's password manager into the `mnemo` repo's GitHub Actions secrets store, where the release workflow (TASK-016) can read them.

## Out of scope

- Using the secrets in CI (TASK-008, TASK-009, TASK-016).
- Rotating the secrets later (covered in the same handoff doc).

## Plan

- DevOps writes `.claude/handoff/github-actions-secrets.md` with the full list of repo secrets the v1 release workflow expects: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Confirm `GITHUB_TOKEN` is the auto-injected one and does not need manual provisioning for publishing to releases.
- Doc covers the path: repo Settings → Secrets and variables → Actions → New repository secret. Each secret name is exactly the variable name electron-builder / `@electron/notarize` look up at runtime.
- Doc includes a rotation cadence note: cert renews annually (calendar reminder); `APPLE_APP_SPECIFIC_PASSWORD` rotates if leaked.

## Acceptance

- Client confirms all five secrets are visible in the repo's Actions secrets list (names only — values are write-only after creation).
- The handoff doc is committed and links from `.claude/ceo-brain.md` are added so future contributors find it.

## Notes

- This task is the last gate before TASK-016 can wire the macOS leg of the release workflow.
- A common mistake: the client pastes a `.p12` instead of the base64 of a `.p12`. The handoff doc explicitly shows the `base64 -i ... | pbcopy` step.

