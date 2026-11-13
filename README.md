# Threva app

Threva is one product for a local user: a workspace that keeps the thread of a project between AI sessions. This repository holds the product layer. Cortex is the engine underneath it.

## How the pieces fit

- **Cortex** runs locally as a daemon. Its Mission Control server on `127.0.0.1:8767` holds every capability Threva uses: ranked items, the command bar, mail sorting and rules, Studio threads, routines, rulings, Balance and My Day.
- **This repository** holds the Threva UI, the brand, the installer and the product docs. It contains no backend logic.
- Threva talks to Cortex only over Cortex's local HTTP and WebSocket API. It never imports Cortex modules. Cortex is AGPL-3.0 and not published as a package, and its internals carry no contract.
- A Cortex stack serves the built Threva UI from a configured directory, so the UI and the API share one origin and Cortex's Host and Origin checks apply unchanged.
- The product ships as one bundle: an installer that pins a Cortex release, the adapters it needs and this UI, writes a minimal stack config and registers a local service.

## Layout

- `prototype/` is a read-only snapshot of the clickable prototype from `jcfischer/threva` (`try/proto` and `try/page` at commit `3816c84`). It runs on made-up scenario data and is the UX reference for the port. Do not build on its code structure without a decision that says so.
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

The stack keeps its config, data and logs in `THREVA_DEV_DIR` (default `~/work/threva-dev`) and points `HOME` and Cortex's directories there, so it doesn't read or change another Cortex stack on the machine. It has no NATS bus, no Discord and no Ranger. `THREVA_DEV_PORT` changes the port. The sample calendar is written relative to the start time, with one meeting about to start and one that just ended. The first start also makes `studio/` a git repository with two sample threads, one of which waits on you; later starts leave that repository and its history alone, so delete `studio/` to get the samples back. After changing the UI, `bun run build` is enough, because the stack serves `dist/ui/` as it is.

### Conversations and the parser

Without more configuration, the dev stack has no model: the bar falls back to Cortex's built-in rules, and a conversation refuses its first turn. Two files, kept outside this repository, add the models you already use:

- `THREVA_DEV_LANES` names a YAML file with Cortex's `mc.desk.conversations` block. The stack copies it into its config and runs `pi` through a wrapper in `THREVA_DEV_DIR/bin`, so pi uses your own `HOME`, configuration and credentials.
- `THREVA_DEV_PARSER_ROUTING` names a `desk-parse` routing file (see `docs/parser-routing.md` in cortex-desk-adapters). The stack runs `desk-parse --routing-config <file>` as the Desk's parser, with your own `HOME`, and permits the providers in the file that Cortex accepts as parsers (`codex` and `pi`). The parser asks the Ranger command and config that the file names which provider to use.

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
