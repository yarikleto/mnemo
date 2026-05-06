# Playwright e2e

End-to-end specs that drive a packaged-equivalent Electron build via
`@playwright/test`'s `_electron.launch()`. Each test isolates itself by
pointing Electron at a fresh temp `userData` directory (so single-instance
lock and onboarding gate behave like real first-runs) and a fresh temp
vault.

## Running

```bash
npm run build      # required — specs launch dist-electron/main/index.js
npm run e2e        # full suite, ~30 s
npx playwright test tests/e2e/onboarding.spec.ts   # single spec
```

## Spec coverage

| Spec | TVC | What it asserts |
| --- | --- | --- |
| `onboarding.spec.ts` | TVC-B1, TVC-B2 | Fresh userData → `/onboarding`; "Use the default" → `/review`; cards/ + state/ created on disk. |
| `live-edit.spec.ts` | TVC-C2 | A card written directly into the vault by an external process appears in `/browse` within 1500 ms (chokidar live-sync). |
| `window-state.spec.ts` | TVC-D1, TVC-D3 | Window bounds round-trip across quit + relaunch; `lastRoute` replay routes the user back to `/dashboard`. |
| `offline.spec.ts` | TVC-F1 | With networking disabled, the review screen loads and a card can be rated end-to-end. |

## How the userData reset works

`launchApp` in `helpers.ts` mints a fresh `mkdtemp` directory and passes it
to Electron via `--user-data-dir`. That directory is the truth for
`config.json`, `window-state.json`, the orphan-state cleanup pass, and the
single-instance lock. Cleaning up after the test removes the directory
entirely — so reruns are deterministic and parallel runs don't collide.

The `seedConfig` option pre-writes a config.json so a spec can skip the
onboarding screen and land directly on `/review` against a known vault
layout. The `seedVault` option pre-creates `cards/` + `state/` and seeds
markdown files inside.

## Auto-update is NOT mocked here

The auto-update e2e is the round-trip rehearsal in `TASK-018` (manual,
against signed CI artifacts). Mocked auto-update has consistently been a
high-flake / low-value test. The `offline` spec asserts the review flow
keeps working when the updater fails to reach GitHub, which is the only
auto-update assertion that has a meaningful failure mode in CI.
