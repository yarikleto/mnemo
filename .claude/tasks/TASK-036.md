# TASK-036 — README install instructions: Gatekeeper / SmartScreen / AppImage

**Milestone:** M2
**Owner:** DevOps (tech-writer hat)
**Size:** S
**Depends on:** TASK-017 (so we know what users actually see on macOS), SPIKE-002 (Windows behaviour confirmed)

## Goal

Tell users what to expect on each platform. macOS should be silent (signed + notarized). Windows users will hit SmartScreen until M3. Linux users need to `chmod +x` an AppImage. Document each path so first-touch friction does not become a one-star review.

**Verifies:** prerequisite for the v1 ship checklist — closes the "user gets confused at install" failure mode that VC-1 implicitly covers.

## Out of scope

- The actual installer artifacts (TASK-017 / TASK-033 / TASK-034 produce them).

## Plan

- Add an "Installation" section to `README.md` with three subsections:
  - **macOS.** "Download the `.dmg` from the latest release, double-click, drag Mnemo to Applications, launch. No warnings expected." (One-line confidence; matches the signed + notarized reality.)
  - **Windows.** "Download `Mnemo-Setup-X.Y.Z.exe`. SmartScreen will say 'Windows protected your PC' — click 'More info' → 'Run anyway'. v1 ships unsigned; signed builds are a v1.x fast-follow once a few Windows users surface." Include a screenshot if cheap; otherwise text-only.
  - **Linux.** "AppImage: `chmod +x Mnemo-X.Y.Z.AppImage && ./Mnemo-X.Y.Z.AppImage`. Some desktops will prompt to integrate it into the launcher — accept if you want a menu entry. `.deb`: `sudo dpkg -i mnemo_X.Y.Z_amd64.deb`."
- Add a brief "Updates" section noting auto-update on macOS + (per SPIKE-001) Linux AppImage; manual download required on Windows until M3.

## Acceptance

- README has an Installation section that any of the three platforms' user can follow without external help.

## Notes

- The vision (§"MVP Definition") explicitly says "If we're not slightly embarrassed by the unsigned Windows warning at v1, we launched too late." The README is where we own that embarrassment honestly.

