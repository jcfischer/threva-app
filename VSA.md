---
task: "Threva: a local workspace for knowledge work that keeps the thread of a project between AI sessions, installable by a newcomer without help"
slug: threva-app
effort: E3
phase: observe
progress: 5/18
started: 2026-11-16T00:00:00.000Z
updated: 2026-11-16T00:00:00.000Z
verified: false
---

## Problem

Threva ships fast, but its own destination cannot be run yet, and nothing measures whether anyone uses it. Evidence read on 2026-11-16 (read-only, from the repo and public GitHub data):

- The repo states the product: "one product for a local user: a workspace that keeps the thread of a project between AI sessions" (`README.md:3`). It does not yet say how anyone would know the product works for its users.
- Throughput is high: since the first commit on 2026-11-13 there are 70 commits, 67 merged PRs and 91 closed issues (`git log`, `gh pr list --state merged`, `gh issue list --state closed`).
- The map's destination (issue #1: `brew install` from the project's tap, `threva setup`, one mail account and one calendar, then Day queue, capture, search, sorted mail and Studio on a clean account) cannot be run. The `homebrew-threva` tap does not exist (`gh repo view`), the repo has no tag or release (`git tag`, `gh release list`), mail and calendar setup are open (#141, #142, #146), and search is open (#145) behind a Cortex prerequisite (#149).
- Issue #8, which decides data boundaries, export and deletion, has been open since 2026-11-13.
- Nothing in the repo records use, such as time to a first saved thread or whether a user returns after two and four weeks.
- None of the 23 open issues cites a criterion, because no `VSA.md` exists. Six of them are open grilling nodes (#102 to #105, #140, #148).
- A public tracked file holds a personal home path: `.claude/skills/verify-threva/SKILL.md:17`, `:18` and `:24`.

## Vision

Three-level ideal state. Levels 1 and 2 were confirmed on 2026-11-16 (ISC-1).

- **Level 1 — Life outcome.** A knowledge worker uses Threva as their workspace and picks up a project where they left it. Their mail, calendar, notes and the decisions behind them sit in one place, so they never re-explain a project's context to an AI.
- **Level 2 — System behavior.** On a clean Mac, `brew install` and `threva setup` give a newcomer a working Threva on their own mail and calendar with no help. The Day queue, the bar, sorted arrivals and Studio topics work against the local Cortex, and every failure says what to do next. Agents build only what the destination test or a failing criterion here needs.
- **Level 3 — Mechanism.** A Homebrew tap pins a threva-app tag and a Cortex tag with its source. `threva setup`, `launch` and `doctor` own install, start and diagnosis. Cortex serves the built UI on one origin, and the named Desk client is the only HTTP path. Backend gaps go to Cortex, never into this repo. `bun run check`, `verify:ui` and Bombadil exploration prove each change.

Euphoric surprise: a user writes that Threva showed her why she made a decision three weeks ago, and that mail is the first the maintainers hear of her install.

## Out of Scope

- Backend logic of any kind. It lands in Cortex behind the Desk API (`AGENTS.md:5`, `:6`).
- A native app shell. Issue #5 decided on no shell.
- Discord, and NATS unless agent dispatch is in the first offer (issue #1 Constraints).
- Pricing, a public website and self-service signup.
- Hosting adapter views (decided "not now" in #121) and local specialist models (#148).
- Nodes the destination test does not need, as triage ruled for #99, #100, #101 and #139.

## Principles

- The UI arranges what Cortex sends; it derives no rules of its own (#119).
- A node exists only if the destination test or a failing ISC needs it.
- A change is proven on the real surface, in a browser against a running stack, not by unit tests alone.
- Merged PRs are not progress. Only an ISC flipping from failing to passing counts.
- Evidence of use comes before scaling: repeated use without reminders beats more features.

## Constraints

- Threva reaches Cortex only over the local Mission Control HTTP and WebSocket API, never by import or copied source (`AGENTS.md:5`).
- AGPL-3.0-only. A bundle that ships Cortex ships its source (#115, `README.md` Licence).
- TypeScript and Bun. `bun run check` passes before every PR (`AGENTS.md`, rule 4).
- Every user-facing string comes from the typed message catalog (`AGENTS.md`, rule 6).
- `eslint-suppressions.json` may only shrink (`AGENTS.md`, rule 7).
- No credentials, private account values or personal context in public content (issue #1 Constraints).
- Publishing a release, the tap or an invitation to users needs a maintainer's yes.

## Goal

A newcomer on a clean Mac passes all steps of the issue #1 destination test without help, from a tagged release in a public tap. Every open build node cites a failing ISC from this file.

## Checkpoints

### Gate
- [x] ISC-1: The maintainers confirm Levels 1 and 2 of this Vision, recorded with a date in Decisions.

### Destination (issue #1)
- [ ] ISC-2: The project's `homebrew-threva` tap holds a formula whose main source is a threva-app tag and whose Cortex resource has a sha256.
- [ ] ISC-3: threva-app has at least one release tag.
- [ ] ISC-4: On a clean macOS user account, `brew install` from the tap and `threva setup` exit 0 and the UI opens in the browser.
- [ ] ISC-5: After `threva setup`, the Day queue shows mail from the one account it connected.
- [ ] ISC-6: After `threva setup`, the Day view shows events from the macOS calendar it connected.
- [ ] ISC-7: On the installed stack, a note captured from the bar is found by a search from the bar.
- [ ] ISC-8: On the installed stack, a mail that arrives after setup is sorted into one of the four outcomes with no user action.
- [ ] ISC-9: On the installed stack, a Studio topic can be parked and another finished from the UI.
- [ ] ISC-10: With the service stopped, `threva doctor` exits non-zero and names the cause and the next step.

### Product proof
- [ ] ISC-11: Issue #8 is closed with a decision on backup, restore, export and deletion.

### Aimed work
- [ ] ISC-12: Every open issue labelled `orienteer:build` cites an ISC from this file.
- [ ] ISC-13: Every open issue labelled `orienteer:grilling` is closed or cites an ISC from this file.

### Health
- [x] ISC-14: `bun run check` exits 0 on `main`.
- [x] ISC-15: Under `src/ui`, only `src/ui/api/client.ts` calls `fetch`.

### Anti-criteria
- [x] ISC-16: Anti: No file under `src/` imports Cortex's runtime or a Cortex source path; the only imports from `@the-metafactory/cortex` are type-only, from its `desk-api` (AGENTS.md rule 1).
- [x] ISC-17: Anti: The total count in `eslint-suppressions.json` does not exceed 218.
- [ ] ISC-18: Anti: No tracked file outside `test/` contains a personal home path.

## Test Strategy

| ISC | Probe |
| --- | --- |
| 1 | `grep -n "confirmed: levels 1-2" VSA.md`, dated. |
| 2 | `gh api repos/<owner>/homebrew-threva/contents/Formula/threva.rb`, then grep for `url`, `resource` and `sha256`. |
| 3 | `git tag --list` is non-empty; `gh release list` shows the tag. |
| 4–9 | One scripted run on a fresh macOS user with a test mail account and calendar; `verify:ui` journeys pointed at the installed origin, with screenshots kept as the receipt. |
| 10 | `brew services stop threva; threva doctor; echo $?` is non-zero and the output names a next step. |
| 11 | `gh issue view 8 --json state,stateReason`. |
| 12, 13 | `gh issue list --state open --label <label> --json number,body`, then each body greps for `ISC-`. |
| 14 | `bun run check; echo $?`. |
| 15 | `grep -rln "fetch(" src/ui` returns only `src/ui/api/client.ts`. |
| 16 | `git grep -nE "@the-metafactory/cortex" -- src | grep -v '/desk-api"'` prints nothing, and `bun run lint` passes (`eslint/cortex-imports.ts` rejects a runtime import from that package). |
| 17 | `jq '[.. \| numbers] \| add' eslint-suppressions.json` is at most 218. |
| 18 | `git grep -nE "/Users/[a-z]+/" -- . ':!test' ':!bun.lock'` prints nothing. |

## Features

| Feature | Satisfies | Where |
| --- | --- | --- |
| F-gate: confirm levels | ISC-1 | this file |
| F-tap: release tag and Homebrew formula (#137) | ISC-2, 3, 4 | threva-app, homebrew-threva |
| F-connect: setup connects mail and calendar (#140, #141, #142, #146) | ISC-5, 6, 8 | threva-app, cortex-desk-adapters |
| F-search: search from the bar (#145, #149) | ISC-7 | cortex, threva-app |
| F-studio-check: run the Studio journey on the installed stack | ISC-9 | threva-app |
| F-doctor: actionable failed-start report | ISC-10 | threva-app |
| F-data: backup, export, deletion (#8) | ISC-11 | threva-app, cortex |
| F-aim: cite ISCs on open nodes, close or link grilling nodes | ISC-12, 13 | map #1 |
| F-hygiene: remove the home path | ISC-18 | threva-app |

Order: F-gate first. Then F-tap and F-connect, because ISC-4 to ISC-9 cannot be probed without an install.

## Decisions

- 2026-11-16: Drafted from the repo, issue #1 and public `gh` reads.
- 2026-11-16: Threva is a workspace for knowledge work. It serves no active personal goal, so this file has no `serves:` field.
- 2026-11-16: This file names no person and no private goal, because threva-app is a public repository.
- 2026-11-16: confirmed: levels 1-2 (jcfischer). Level 3 stays the builders' to change.
- 2026-11-16: ISC-14 to ISC-17 verified: `bun run check` exit 0 at `f6ef871` (619 tests, 0 failures); the `fetch` and import greps; the suppressions total is 218. ISC-18 fails on `.claude/skills/verify-threva/SKILL.md:17`.
