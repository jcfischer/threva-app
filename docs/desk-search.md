# Desk search prerequisite

Node #149 supplies the Cortex prerequisite for node #145 and VSA ISC-7. Cortex search landed in [Cortex PR #3808](https://github.com/the-metafactory/cortex/pull/3808), commit `5835e3e2b9f09690f8d3ccb8fccf9f4bb284e844`, and ships in release `v6.34.0` (`a443dd118e249c597a74004b553f29ae5e2bb039`). That release serves Desk API `1.11.0`. Threva pins its types to this release and the dev stack requires a checkout containing this tag.

Fetch the release tags and update the Cortex checkout used by `CORTEX_DIR` to `v6.34.0` or a descendant before running `bun run dev:stack`. A checkout at `v6.33.0` is refused. No backend code or client-side search belongs in Threva.

## Search

```http
GET /api/desk/search?q=budget&limit=10&offset=0
```

The upstream contract is the [published search types](https://github.com/the-metafactory/cortex/blob/v6.34.0/src/desk-api/wire/search.ts), [HTTP handler](https://github.com/the-metafactory/cortex/blob/v6.34.0/src/surface/mc/api/desk-search.ts) and [search implementation](https://github.com/the-metafactory/cortex/blob/v6.34.0/src/surface/mc/desk/search.ts). The exported `DeskSearchResponse`, `DeskSearchHit` and `DeskSearchKind` types are available through a types-only import from `@the-metafactory/cortex/desk-api`.

| Parameter | Contract |
| --- | --- |
| `q` | Required, trimmed, 1–200 characters. Cortex matches every whitespace-separated term, without regard to case, in the record's title and searchable text. |
| `kinds` | Optional comma-separated list from the kinds below; omitted or empty means all kinds. |
| `limit` | Integer 1–20, default 10. |
| `offset` | Integer 0–500, default 0. |

The response is `{status: "ok" | "empty", hits, next, unavailableKinds}`. Each hit has `{kind, id, title, snippet, at, open: {method, path, query}}`. `snippet` contains up to 300 characters of record text, `at` is an ISO timestamp or `null`, and `(kind, id)` identifies the hit across repeated searches. Follow `next` as a relative URL until it is `null`; Cortex orders dated hits newest first and undated hits after them.

| Kind | Search coverage | GET route in `hit.open.path` |
| --- | --- | --- |
| `desk-note` | Open Desk notes | `/api/desk` |
| `desk-reminder` | Open reminders | `/api/desk` |
| `studio-capture` | Inbox captures and captures filed in thread material | `/api/desk/studio` |
| `studio-thread` | Active, parked and closed threads: question, stand and outcome text | `/api/desk/studio` |
| `desk-item` | Current Desk cards: title and summary | `/api/desk` |
| `balance-task` | Tasks in configured Desk areas | `/api/desk/balance-surfaces/task` |
| `balance-project` | Projects in configured Desk areas | `/api/desk` |

An invalid query, kind, limit or offset returns HTTP 400. A disabled Desk returns 503; methods other than GET return 405. Successful responses carry `x-desk-api-version` and `Cache-Control: no-store`. A missing or unreadable Studio appears in `unavailableKinds` for the requested Studio kinds; an empty result alone does not prove that every kind was searched.

## Open a hit

Use the returned GET path with its `open.query` URL-encoded as query parameters. The contract also publishes the per-kind paths under `vocabularies.DESK_SEARCH_OPEN_ROUTES` on `GET /api/desk/contract`.

The Desk and Studio reads return collections. Select a Desk note/reminder by ID, a card by key, an inbox capture by ID (legacy inbox captures may use a path), or a thread by slug. Thread hits include `thread` in `open.query`; Balance hits include `ref` and, when known, `area`. The Studio read returns its view even when `thread` is supplied. A Balance project is opened from the Desk outline, not the task-only read route.

For captures filed in thread material, search returns a stable capture ID and snippet, but its opening query is empty and the Studio material view omits that ID. Show the returned snippet for these hits; the opening route reaches the Studio collection, not an individually addressable capture. This release supplies readable hit text, but no targeted read operation for filed captures.

The search UI and its named client calls belong to node #145. This prerequisite does not resume that node; Ranger's resume watch owns that transition.

## Verification

Publication checked on 2026-11-17 with `git ls-remote https://github.com/the-metafactory/cortex.git refs/tags/v6.34.0`: the upstream tag points to `a443dd118e249c597a74004b553f29ae5e2bb039`. In a Cortex checkout, `git merge-base --is-ancestor 5835e3e2b9f09690f8d3ccb8fccf9f4bb284e844 a443dd118e249c597a74004b553f29ae5e2bb039` exited 0, confirming that the release contains search.

The offline release assertions in `test/dev-stack-cortex-minimum.test.ts` require this exact verified tag for both the dependency pin and the dev-stack minimum. When upgrading, verify the new upstream tag and its search implementation before updating those assertions. A version comparison cannot prove publication. The separate temporary-repository test checks checkout ancestry only.

Verified on 2026-11-17 against the installed `v6.34.0` source. `bun test test/dev-stack-cortex-minimum.test.ts` passed all six tests, including rejection of `v6.33.0` and acceptance of `v6.34.0` through the default minimum. In the installed Cortex directory, `bun run test src/surface/mc/__tests__/desk-search.test.ts` passed all eight search tests, and `bun scripts/probe-desk-search.ts` exercised the real HTTP server: a note search returned 200 with its snippet and opening route; an empty query returned 400.

Node #145 owns browser verification of the command bar’s capture-and-search journey.
