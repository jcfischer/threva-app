# Working in threva-app

Read `README.md` first. These rules hold for every change.

1. Threva reaches Cortex only over HTTP and WebSocket on the local Mission Control server. Never import Cortex's runtime from `@the-metafactory/cortex` or copy Cortex source into this repository. A types-only import of its published `desk-api` is allowed: it disappears from the build. Lint rejects a runtime import from that package.
2. When Threva needs something the Cortex API does not return, record it as a gap and file the change against Cortex. Do not work around it with logic here.
3. The UX reference is the clickable prototype in the private `jcfischer/threva` repository: `try/proto` and `try/page` at commit `3816c84`.
4. Use TypeScript and Bun. `bun run check` must pass before a pull request.
5. Reference work-graph nodes with `Refs #N` in commits and pull request text, never `closes`, `fixes` or `resolves`.
6. User-facing text is English first, written plainly, in the voice of the prototype. Every string the UI shows comes from the typed message catalog, so German and other languages can be added without touching components. Text that Cortex returns is shown as Cortex sends it.
7. `bun run lint` (part of `bun run check`) runs ESLint with `threva/no-comments`. Inline `eslint-disable` does nothing. Existing violations live in `eslint-suppressions.json`, which may only shrink: after fixing one, run `bun run lint --prune-suppressions`.
