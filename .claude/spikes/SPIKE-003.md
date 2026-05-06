# SPIKE-003 — `macos-14` arm64 runner producing a universal DMG

> Time-boxed: 1 day. Resolves before TASK-016 commits to a single-runner Mac matrix.

## Question

Can a `macos-14` (arm64-only) GitHub Actions runner produce a **universal** DMG that runs natively on Intel Macs, or do we need a separate `macos-13` (x64) leg?

## Findings (research-tier; confirm with the real `v0.0.1-rc1` build)

- `macos-14` runners are M1-class arm64 machines but ship the full Apple toolchain (`xcrun`, `lipo`, the universal SDK). `electron` ships **per-arch prebuilt binaries**; `electron-builder` invokes `lipo` to fuse them into a universal `.app`.
- Our `electron-builder.yml` declares `target.arch: [arm64, x64, universal]` for both DMG and ZIP. Per-arch builds produce `Mnemo-X.Y.Z-arm64.dmg` and `-x64.dmg`; the `universal` variant produces `Mnemo-X.Y.Z-universal.dmg` containing both slices.
- All native-module rebuilds (`@electron/rebuild` is invoked transitively by electron-builder) for x64 happen on the arm64 runner via Rosetta-emulated node calls. This works because better-sqlite3, fsevents, etc. all have prebuilt binaries published for both arches; `node-gyp` is rarely invoked.
- The single failure mode where a separate `macos-13` runner is required is: a native module that has **no x64 prebuilt** AND requires `node-gyp` to compile from source. We don't ship any such module. Mnemo's native deps: `chokidar` (pure-JS), `fsevents` (prebuilt), `gray-matter` (pure-JS). All clear.

## Decision

- **Single `macos-14` leg.** No separate `macos-13` x64 runner needed. ADR-011's assumption stands.
- **Universal DMG is the canonical macOS artifact.** Per-arch DMGs are also published (electron-builder's default behaviour with the matrix above) but not advertised; the README points at the universal variant.

## Open follow-ups

- If a future native module slips into the dep tree without an x64 prebuilt, this assumption breaks. Add a CI check or guard in `package.json` review: any new native module gets a "prebuilds for x64+arm64?" sanity gate.
- Watch for arm64 runner deprecation — Apple silicon M1 has been GA on Actions since 2024-Q4 and is the default Mac runner now; this won't regress.
