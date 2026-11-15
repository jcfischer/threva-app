# Everything

## Sub-features

The outline of areas and topics with open counts, a topic's thread page, note pages with the editor, and the assistant's margin notes.

## How to get to it (user POV)

Click "Everything" in the "View" group under the bar.

## Driving it with Playwright

`bun run verify:ui everything`. It clicks Everything, waits for "Loading your outline…" to go away, checks the button is pressed, and switches back to Day. The sample data has one area, "Work", with 2 open.

## Gotchas

The assistant's margin and lifting text need a model; without the operator files they report errors.
