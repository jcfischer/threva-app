# Working in threva-app

Read `README.md` first. These rules hold for every change.

1. Threva reaches Cortex only over HTTP and WebSocket on the local Mission Control server. Never import from `@the-metafactory/cortex` or copy Cortex source into this repository.
2. When Threva needs something the Cortex API does not return, record it as a gap and file the change against Cortex. Do not work around it with logic here.
3. `prototype/` is a reference snapshot. Never edit it.
4. Use TypeScript and Bun. `bun run check` must pass before a pull request.
5. Reference work-graph nodes with `Refs #N` in commits and pull request text, never `closes`, `fixes` or `resolves`.
6. User-facing text is German first, written plainly, in the voice of the prototype.
