# SPIKE-001 — Does `electron-updater@^6.3.9` work for AppImage on Ubuntu 22.04 / 24.04?

**Milestone:** M2 (unblocks TASK-014's Linux UX, TASK-034)
**Owner:** DevOps
**Size:** S — 1-day timebox
**Depends on:** TASK-014 (so there's a built updater module to test against)

## Question

ADR-006 promises auto-update on Linux AppImage as part of why we picked `electron-updater` over `update-electron-app`. Verify the claim before TASK-034 commits to the Linux release leg's UX shape.

## Method (timeboxed: 1 working day)

- On a fresh Ubuntu 24.04 LTS VM:
  - Install Mnemo v0.0.1 from the AppImage (`chmod +x` + run).
  - Publish v0.0.2 to the test repo (the same draft-release flow as TASK-018).
  - Observe whether the running v0.0.1 picks up v0.0.2 within 30 minutes.
  - Confirm the AppImage is replaced in place (or whatever the actual update mechanism is) and v0.0.2 launches cleanly.
- Repeat on Ubuntu 22.04 LTS (still in support).
- Note: KDE / GNOME / XFCE differences. Defaults to GNOME on the LTS variants.

## Outputs

- A short markdown note `.claude/spikes/SPIKE-001.md` (or appended to this file as a "Findings" section) covering: works / does-not-work, any extra config required (e.g. `latest-linux.yml` provider override), and any UX caveat (e.g. user must restart manually because in-place replace requires it).

## Decision triggered

- If positive: TASK-034 ships as planned, README's Updates section claims macOS + Linux auto-update.
- If negative: TASK-034 ships unsigned + manual-download for Linux users; README's Updates section says so. The renderer banner UX (TASK-015) might need a "Download from GitHub" CTA for Linux instead of "Restart now."

