# TASK-013 — `afterPack` hook: `@electron/fuses`

**Milestone:** M0
**Owner:** DevOps
**Size:** S
**Depends on:** TASK-004

## Goal

Flip the eight Electron fuses from ADR-012 on every packaged binary, before signing. Locks down `ELECTRON_RUN_AS_NODE`, `--inspect`, ASAR tampering, and friends.

**Verifies:** TVC-A4 (fuses match table). Trace: VC-1 + defense-in-depth.

## Out of scope

- Validating fuses post-build (covered by `npx @electron/fuses read` in TASK-017).

## Plan

- Author `build/fuses.cjs` (CommonJS). The hook:
  - Imports `flipFuses`, `FuseVersion`, `FuseV1Options` from `@electron/fuses`.
  - Computes the path to the unpacked Electron binary inside `appOutDir` (varies by platform — the package's docs cover the macOS / Windows / Linux paths).
  - Calls `flipFuses(binaryPath, { version: FuseVersion.V1, [FuseV1Options.RunAsNode]: false, [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, [FuseV1Options.EnableNodeCliInspectArguments]: false, [FuseV1Options.EnableCookieEncryption]: true, [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, [FuseV1Options.OnlyLoadAppFromAsar]: true, [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false, [FuseV1Options.GrantFileProtocolExtraPrivileges]: false })`.
- Reference the hook: `afterPack: build/fuses.cjs` in `electron-builder.yml`.
- Confirm execution order: electron-builder runs `afterPack` BEFORE `afterSign`. That is the correct order — fuses must flip before the binary is signed, otherwise the signature does not cover the fuse bits.

## Acceptance

- `build/fuses.cjs` exists, is referenced from `electron-builder.yml`.
- After a local mac build, `npx @electron/fuses read out/mac-universal/Mnemo.app/Contents/MacOS/Mnemo` matches the table in ADR-012.

## Notes

- `EnableEmbeddedAsarIntegrityValidation` is a no-op on Linux (Electron 30+). That is fine — Linux is best-effort and unsigned in v1.

