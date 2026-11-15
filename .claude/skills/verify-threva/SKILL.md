---
name: verify-threva
description: Prove a Threva UI change on the real surface. Starts an isolated Cortex dev stack from this checkout, drives the built UI in headless Chromium with scripted journeys (bun run verify:ui) and explores it with Bombadil properties (bun run explore:ui), and keeps screenshots and traces as evidence. Use when a change touches src/ui and happy-dom tests alone don't show what a person sees.
---

# verify-threva

Threva's surface is one web page that Cortex serves with the built `dist/ui`. Tests run on happy-dom and never see a real browser, real layout or Cortex's real answers. This skill does.

Never drive the principal's own stack on port 8790 from `~/work/threva-dev`: Bombadil clicks archive, send and make tasks, and those write to the stack's data. Always start your own stack.

## Launch

From the checkout under test (a worktree is fine):

```bash
export CORTEX_DIR=/Users/fischer/work/threva-dev/cortex
export CORTEX_ADAPTERS_DIR=/Users/fischer/work/mf/cortex-desk-adapters
export THREVA_DEV_DIR="$SCRATCH/verify-stack"   # any fresh directory, never ~/work/threva-dev
export THREVA_DEV_PORT=8791                     # any free port except 8790
bun run dev:stack
```

Ready means the command printed `Threva runs on http://127.0.0.1:8791/`. It builds `dist/ui` first, so the stack serves this checkout's code. `CORTEX_DIR` must support `mc.ui.dir`; `/Users/fischer/work/mf/cortex` did not on 2026-11-14 and served Cortex's own Desk UI instead. Without `THREVA_DEV_LANES`, `THREVA_DEV_PARSER_ROUTING` and `THREVA_DEV_STUDIO_FILER` (see README.md) there is no model: conversations refuse, and captures and Studio sessions answer 503. Journeys that need a model report that as a failure.

After changing UI code, `bun run build` is enough; the stack serves `dist/ui` as it is.

## Doctor

```bash
bun run dev:stack status
```

Then run the `day` journey. If it fails with `Page title is "…", not "Threva"`, the stack serves another UI: check `CORTEX_DIR`. The stack refuses to start while `$THREVA_DEV_DIR/.../pid` exists from an earlier run; stop it first.

## Drive

Scripted journeys, defined in `scripts/verify-ui-lib.ts` (`journeys`), with selectors from roles and the English catalog:

```bash
bun run verify:ui                      # every journey
bun run verify:ui everything --out "$SCRATCH/evidence"
```

Each journey screenshots each step, records console errors, uncaught exceptions and HTTP responses of 400 or more, and writes `report.json`. Exit 0 means every journey passed. Add a journey to `journeys` for the feature you changed, using `getByRole` and catalog text, and wait for the loading text (`Loading your cards…`, `Loading your outline…`) to go away before a screenshot; a screenshot of a loading state proves nothing.

Property exploration with Bombadil clicks, types, scrolls and reloads at random and checks the properties in `explore/threva.ts` on every state:

```bash
bun run explore:ui --time-limit 2m --out "$SCRATCH/explore"
```

Exit 2 means a property was violated, and the output names it. Replay a run with `bunx bombadil browser test <url> explore/threva.ts --headless --reproduce <out>` and look at it with `bunx bombadil browser inspect <out>`. `explore:ui` finds Chromium in Playwright's cache; if there is none, run `bunx playwright-core install chromium-headless-shell` once, or set `CHROME`.

The feature map in `features/` says what to drive for each part of the UI.

## One command

`bun run probe:ui` does Launch, Drive and Cleanup in one go: it starts a stack in a fresh temporary `THREVA_DEV_DIR` on a free port, runs every journey and a Bombadil run (`THREVA_PROBE_EXPLORE`, default `2m`), stops the stack, and prints `FAILED: verify:ui · explore:ui` for what failed. It needs `CORTEX_DIR` and `CORTEX_ADAPTERS_DIR`. Evidence goes to `THREVA_PROBE_OUT`, or to `evidence/` in the temporary directory. Set it as threva-app's `commands.probe` in ranger.yaml and ranger runs it before a pull request is marked ready.

## Evidence

Attach to the pull request what the journey proved: the screenshots of the changed feature, the PASS lines, and any console error or HTTP failure it listed with a reason. For an exploration, the property list and the exit code. Keep evidence outside the repository (`$SCRATCH/...`) or in `.verify/`, which git ignores.

## Cleanup

```bash
bun run dev:stack stop                 # with the same THREVA_DEV_DIR and THREVA_DEV_PORT exported
```

This stops only the stack this checkout started (by its pid file). Delete `$THREVA_DEV_DIR` when done; it holds only that stack's sample data. Evidence directories stay.
