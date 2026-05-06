# TASK-FF-1 — Azure Trusted Signing tenant handoff (post-v1 fast-follow)

**Milestone:** M3 (post-v1)
**Owner:** DevOps (handoff guide) → Client (tenant provisioning)
**Size:** S
**Status:** **BLOCKED on client action**, but also blocked on "≥ 5 Windows users surface" per vision §"Constraints".
**Depends on:** v1 shipped + Windows audience materialising.

## Goal

Get the maintainer onto Azure Trusted Signing (or DigiCert KeyLocker — pick one based on cost / friction) so a Windows code-signing cert can be obtained and used in CI.

## Out of scope

- Wiring the cert into electron-builder (TASK-FF-2).

## Plan

- DevOps writes `.claude/handoff/windows-signing-tenant.md` covering:
  - Decision matrix: Azure Trusted Signing (~$10/mo + cert) vs DigiCert KeyLocker (~$300/yr) vs SSL.com eSigner. Recommend Azure Trusted Signing for cost.
  - Business identity validation steps (the slow part — multi-day for individuals; multi-week for non-US companies).
  - The cert-issuance flow inside the chosen provider.
  - The secrets to capture: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, plus whatever `azureSignOptions` requires.
- Client kicks off the validation; when the cert is issued, TASK-FF-2 lights up.

## Acceptance

- Handoff doc exists and is concrete enough to act on.
- Client confirms validation kickoff (no time pressure — defer until ≥ 5 Windows users).

## Notes

- This task should NOT block v1. It exists in the plan so the future fast-follow has a known starting point. If the v1.x window has Windows users, this becomes priority; otherwise it sits idle.

