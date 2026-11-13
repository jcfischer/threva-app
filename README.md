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
