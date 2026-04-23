---
name: electron-debug
description: Launch the Electron app headlessly, capture main-process stdio + renderer console + pageerrors + optional screenshot, then exit. Use when you change main/preload/renderer code and need to verify the app boots without errors before reporting work as done, or when debugging a runtime failure that only shows in the renderer devtools.
---

# Electron Debug Runner

## When to use

- After changing anything in `src/main/**`, `src/preload/**`, or `src/renderer/**` and before claiming the task is done.
- When the user reports a runtime error that doesn't show in typecheck/tests (renderer console errors, IPC handler throws, window failing to open, preload bridge missing, etc.).
- When you need a screenshot of the rendered UI to confirm a visual change.

Do NOT use this for pure logic changes already covered by vitest — it costs ~5s and produces noise. Unit tests first; this skill catches integration gaps tests miss.

## How to run

One-shot: build then launch, capture everything, exit.

```bash
npm run build && node .claude/skills/electron-debug/scripts/run.mjs --duration 6000
```

Output is a flat event log with prefixes you can grep:

- `[main:out] …` / `[main:err] …` — stdout/stderr from the Electron main process (ELECTRON_ENABLE_LOGGING=1). Contains console.log/error from `src/main/**`.
- `[main:exit] code=<n> signal=<s>` — main quit. Non-zero code = crash.
- `[renderer:log|warn|error|info] …` — renderer `console.*` output.
- `[renderer:pageerror] …` — uncaught exceptions in renderer (React render errors, IPC unwrap throws, etc.). **These are what you're most likely looking for.**
- `[renderer:crash|close]` — renderer process died or window closed.
- `[screenshot] file:///…` — screenshot path.
- `[done]` — clean exit.

If there are no `pageerror` or `main:err` lines and `[done]` appears, the app boots clean.

### Options

| Flag | Default | Purpose |
|---|---|---|
| `--main <path>` | `dist-electron/main/index.js` | Entry point for `_electron.launch`. |
| `--duration <ms>` | `8000` | How long to hold the window open before closing. Bump to 20000+ if you want to exercise interactions. |
| `--route <hash>` | (none) | Navigate to a hash route after load, e.g. `--route '#/dashboard'`. HashRouter only. |
| `--screenshot <path>` | (none) | Full-page PNG of the rendered window written to this path. Use when you need visual confirmation. |

### Examples

Boot check after main-process edit:

```bash
npm run build && node .claude/skills/electron-debug/scripts/run.mjs --duration 4000
```

Verify a specific route renders:

```bash
npm run build && node .claude/skills/electron-debug/scripts/run.mjs --route '#/dashboard' --duration 6000 --screenshot /tmp/dashboard.png
```

Then `Read` the screenshot file to view it.

## Interpreting output

- **`[renderer:pageerror] Cannot read properties of undefined (reading 'data')`** — usually an IPC call returned `{ok:false}` and renderer didn't unwrap. Check the matching `[main:err]` for the source throw.
- **`[main:exit] code=1` before `[done]`** — main process crashed on load. Look at `[main:err]` right above — most common causes in this repo: a node-only module running in browser context (check that main-only imports stay out of `src/shared/**`), or a module like `ulid` doing PRNG detection at top level (use `src/main/id.ts` instead).
- **No `firstWindow` within 15s** — main ran but never called `BrowserWindow`. Check `src/main/index.ts` for thrown init errors in `app.whenReady()`.
- **`[renderer:error] Failed to load resource`** — Vite dev server not up, or main pointed at wrong URL. Check that `npm run build` completed before launching (this skill uses the built bundle, not the dev server).

## Cleanup

The script always calls `app.close()` before exiting, so there should be no lingering Electron processes. If one leaks (e.g., the script was killed with SIGKILL), clean up with:

```bash
pkill -f "anki/node_modules/electron"
```

## Why not `npm run dev`

`vite` dev mode keeps running — it doesn't self-terminate, which is bad for the Bash tool's timeout budget and background task management. The built bundle + `_electron.launch` is a closed loop: launch, observe, exit. Playwright's Electron launcher also gives structured access to renderer console/pageerrors, which you don't get from `npm run dev` stdout.
