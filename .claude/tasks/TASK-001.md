# TASK-001 — Apple Developer Program enrollment handoff

**Milestone:** M0 — Walking skeleton
**Owner:** DevOps (handoff guide) → Client (enrollment action)
**Size:** S (handoff doc + outbound checklist)
**Status:** **BLOCKED on client action** — agent cannot enroll the user in Apple's program.
**Depends on:** —

## Goal

Get the maintainer enrolled in the Apple Developer Program so a Developer ID Application certificate can be issued. Without this, every macOS user hits a Gatekeeper warning on launch and VC-1 fails before any auto-update work matters.

## Out of scope

- Generating the cert (TASK-002).
- Configuring CI secrets (TASK-003).

## Plan

- DevOps writes `.claude/handoff/apple-developer-enrollment.md` listing: link to enrollment portal, the $99 USD annual fee, the ~2-day approval expectation, the "Individual" vs "Organization" choice (Individual is fine for Mnemo), the Team ID location, and the Developer ID Application cert request flow inside the portal.
- Handoff guide includes a checklist the client copies into their personal task tracker.
- DevOps flags this as priority #1 so it runs in parallel with all other M0 work that does not require the cert.

## Acceptance

- Client confirms enrollment is approved and an "Account" page in the Apple Developer portal shows their Team ID.
- The handoff doc lives at `.claude/handoff/apple-developer-enrollment.md` and explains every field the client may be asked for.

## Notes

- This task **must** be kicked off on day 1 of the v1 push — its 2-day Apple-side wait is the long pole of the critical path.
- The pre-mortem (vision §"Pre-Mortem" #1) explicitly calls this out as the #1 risk to MVP shipping.

