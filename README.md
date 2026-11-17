# Threva app

Threva is one product for a local user: a workspace that keeps the thread of a project between AI sessions. This repository holds the product layer. Cortex is the engine underneath it.

## How the pieces fit

- **Cortex** runs locally as a daemon. Its Mission Control server on `127.0.0.1:8767` holds every capability Threva uses: ranked items, the command bar, mail sorting and rules, Studio threads, routines, rulings, Balance and My Day.
- **This repository** holds the Threva UI, the brand, the installer and the product docs. It contains no backend logic.
- Threva talks to Cortex only over Cortex's local HTTP and WebSocket API. It never imports Cortex modules. Cortex is AGPL-3.0 and not published as a package, and its internals carry no contract.
- A Cortex stack serves the built Threva UI from a configured directory, so the UI and the API share one origin and Cortex's Host and Origin checks apply unchanged.
- The product ships as one bundle: an installer that pins a Cortex release, the adapters it needs and this UI, writes a minimal stack config and registers a local service.
- The bundle pins `cortex-desk-adapters` `v0.2.0`, the first tagged release whose portable mail commands read a mail account file with `--config`. [The adapter release note](docs/desk-mail-adapters.md) holds the tarball sha256 the formula takes and the file contract that `threva setup` writes (node #185, prerequisite for node #146).

## Layout

- The clickable prototype in the private `jcfischer/threva` repository (`try/proto` and `try/page` at commit `3816c84`) is the UX reference for the port. It runs on made-up scenario data. Do not build on its code structure without a decision that says so.
- `src/` holds the app. `test/` holds its tests.

## Check

```bash
bun install
bun run check
```

`bun run check` type-checks the project and runs the tests. Ranger runs the same command on every pull request.

## Work

The route lives on the work graph: the map root issue in this repository, labelled `orienteer:map`. Cortex-side work for Threva lives on a map in `the-metafactory/cortex`. Reference nodes in commits and pull requests with `Refs #N`, never a closing keyword.

## Run it locally

`bun run dev:stack` starts a separate development Cortex stack that serves the built UI with sample calendar and mail data. It needs a Cortex checkout that supports `mc.ui.dir` and a `cortex-desk-adapters` checkout:

```bash
export CORTEX_DIR=/path/to/cortex CORTEX_ADAPTERS_DIR=/path/to/cortex-desk-adapters
bun run dev:stack          # builds dist/ui, starts Cortex on http://127.0.0.1:8790/
bun run dev:stack stop
```

The stack refuses to start when `CORTEX_DIR`'s `HEAD` does not contain the Cortex release tag in `MIN_CORTEX_TAG` (`scripts/dev-stack-lib.ts`), and it fails closed when that tag is not fetched there. A Threva change that relies on newer Cortex behaviour raises `MIN_CORTEX_TAG` in the same pull request. `bun run probe:ui` starts the stack, so it fails the same way.

The minimum is Cortex `v6.34.0`, which ships Desk HTTP search over captures, notes, cards and threads. See [the search API handoff](docs/desk-search.md) for the released contract and how to open a hit (node #149, prerequisite for node #145).

The stack keeps its config, data and logs in `THREVA_DEV_DIR` (default `~/work/threva-dev`) and points `HOME` and Cortex's directories there, so it doesn't read or change another Cortex stack on the machine. It has no NATS bus and no Discord, and it runs Ranger only when a parser-routing file names it (see below). `THREVA_DEV_PORT` changes the port. The sample calendar is written relative to the start time, with one meeting about to start and one that just ended. The first start also makes `studio/` a git repository with two sample threads, one of which waits on you; later starts leave that repository and its history alone, so delete `studio/` to get the samples back. After changing the UI, `bun run build` is enough, because the stack serves `dist/ui/` as it is.

To prove a UI change in a real browser, start a second stack with its own `THREVA_DEV_DIR` and `THREVA_DEV_PORT`, then run `bun run verify:ui` (scripted journeys with screenshots) and `bun run explore:ui` (Bombadil property exploration). `.claude/skills/verify-threva` has the steps.

The sample budget topic includes a relation note to the offsite topic. The `relations` journey requires Cortex to serve that note's `relates` field from disk. For a dev stack seeded before this sample was added, use a fresh `THREVA_DEV_DIR` for verification.

### Conversations and the parser

Without more configuration, the dev stack has no model: the bar falls back to Cortex's built-in rules, and a conversation refuses its first turn. Two files, kept outside this repository, add the models you already use:

- `THREVA_DEV_LANES` names a YAML file with Cortex's `mc.desk.conversations` block. The stack copies it into its config and runs `pi` through a wrapper in `THREVA_DEV_DIR/bin`, so pi uses your own `HOME`, configuration and credentials.
- `THREVA_DEV_PARSER_ROUTING` names a `desk-parse` routing file (see `docs/parser-routing.md` in cortex-desk-adapters). The stack runs `desk-parse --routing-config <file>` as the Desk's parser, with your own `HOME`, and permits the providers in the file that Cortex accepts as parsers (`codex` and `pi`). The parser asks the Ranger command and config that the file names which provider to use.
- `THREVA_DEV_STUDIO_FILER` names a YAML file with Cortex's `mc.desk.studio.filer` block (see `docs/desk-studio.md` in Cortex): an OpenAI-compatible endpoint with `baseUrl` and `model`, optional `apiKeyEnv` or `apiKeyFile`, `caFile` and `timeoutSeconds`, and an optional `local` block with the same fields. Captures, outline questions and Studio sessions use it; without it Cortex answers them with 503. Name the key by `apiKeyEnv` or `apiKeyFile`; the stack refuses any other field, so a key cannot reach the config by value. Relative `apiKeyFile` and `caFile` paths are read from the file's directory.

```yaml
# lanes.yaml: replace the models with your own
local: {provider: local-provider, model: local-model}
cloud:
  - {id: codex, provider: openai-codex, model: codex-model}
  - {id: claude, provider: anthropic, model: claude-model}
```

```bash
THREVA_DEV_LANES=~/threva-dev/lanes.yaml THREVA_DEV_PARSER_ROUTING=~/threva-dev/parser-routing.json bun run dev:stack
```

With either file, the command runs `cortex config validate` on the generated config and stops with Cortex's error if it is refused. A file that is missing or cannot be parsed stops the command before it writes anything.

## Licence

Threva is licensed under the GNU Affero General Public License, version 3 only (`AGPL-3.0-only`). The full text is in [`LICENSE`](LICENSE). The UI's runtime dependencies are MIT; [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) lists each one with its version, licence and the licence text the package ships. `bun run check` fails when `package.json` and that file disagree; `bun run notices` regenerates it. Threva runs Cortex, also AGPL-3.0, as a separate program; Cortex's source offer belongs to the installer's bundle, not to the notices above.
