# TASK-020 — `completeOnboarding` IPC + `onboardedAt` config field

**Milestone:** M1
**Owner:** Developer
**Size:** S
**Depends on:** —

## Goal

Add the verb that commits the user's vault choice. Validates the path is writable, ensures `cards/` and `state/` subdirs exist, writes the new `rootPath` and `onboardedAt` timestamp into config, rebuilds the index, restarts the watcher.

**Verifies:** TVC-B2 (default-path round-trip), TVC-B4 (timestamp written). Trace: VC-2.

## Out of scope

- The picker (TASK-019).
- Onboarding screen (TASK-022).
- Backward-compat boot path (TASK-021).

## Plan

- Extend `ConfigSchema` in `src/shared/schema.ts`:
  - Add `onboardedAt: z.string().nullable().default(null)`.
  - Add `autoUpdate: z.object({ enabled: z.boolean().default(true) }).default({})` (consumed by TASK-014).
  - Add `lastRoute: z.string().nullable().default(null)` (consumed by TASK-025).
- Modify `loadConfig` in `src/main/store/config.ts`: stop auto-creating `cards/` and `state/` under the default rootPath. The default `~/Documents/mnemo` becomes a *suggestion*, not a silent fallback. When no config exists, write a default with `rootPath: ''` (empty sentinel) and `onboardedAt: null`.
- Add the channel `completeOnboarding(input: { rootPath: string }): Promise<ApiResult<Config>>`:
  - Schema: `z.object({ rootPath: z.string().min(1) })`.
  - Handler: validate `path.isAbsolute(rootPath)`; probe writability with a temp file; `fs.mkdir(rootPath/cards, { recursive: true })` and `fs.mkdir(rootPath/state, { recursive: true })`; `patchConfig({ rootPath, onboardedAt: new Date().toISOString() })`; rebuild `ctx.index.buildFrom(rootPath)`; stop the old watcher and start a new one on the new root.
- Mirror in `src/preload/index.ts` and `src/shared/api.ts`.

## Acceptance

- Unit / integration test: calling `completeOnboarding({ rootPath: tmpDir })` writes both subdirs, returns the new config with a non-null `onboardedAt`, and the in-memory index now points at `tmpDir`.
- Existing `loadConfig` tests updated to reflect the new "no auto-mkdir" behaviour.

## Notes

- Watcher swap is the load-bearing piece: forgetting to stop the old chokidar instance leaks file handles and double-fires events.
- The `lastRoute` and `autoUpdate.enabled` fields are added in this task because they ride alongside `onboardedAt` in the same `ConfigSchema` change — splitting them would mean three separate schema migrations.

