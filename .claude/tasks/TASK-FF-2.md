# TASK-FF-2 — Wire Windows signing into the release workflow (post-v1)

**Milestone:** M3
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-FF-1

## Goal

Once the Azure Trusted Signing tenant exists, plumb the secrets into the `windows-latest` job and produce a signed NSIS that does not trip SmartScreen on first install.

**Verifies:** Windows-side equivalent of TVC-A1/A2 (signature chain, OS-level trust). Trace: VC-1 on Windows.

## Out of scope

- The unsigned Windows leg (TASK-033) which already exists.

## Plan

- Add `azureSignOptions` to `electron-builder.yml`'s `win` block per electron-builder ≥ 26's docs. Reference: `endpoint`, `certificateProfileName`, `codeSigningAccountName`.
- Expose `AZURE_*` secrets to the `windows-latest` job in `.github/workflows/release.yml`.
- Verification: a v1.x test tag produces a signed NSIS; install on a Windows machine, no SmartScreen warning. Confirm `signtool verify /v /pa Mnemo-Setup-X.Y.Z.exe` reports success.

## Acceptance

- Signed `Mnemo-Setup-X.Y.Z.exe` published to the release.
- SmartScreen quiet on a fresh Windows machine.

## Notes

- This is the moment the README's Windows section gets updated to drop the SmartScreen click-through copy.

