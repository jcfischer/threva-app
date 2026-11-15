# The Day

## Sub-features

The card queue with "Why now:", one open card with its actions (Join, Make it a task, Not now, Keep on top), the "Then" line, today's timeline on the right, the Inbox and Delegated lines, and the notification control.

## How to get to it (user POV)

Open the page. Day is the view that opens first; the "Day" button in the "View" group is pressed.

## Driving it with Playwright

`bun run verify:ui day`. Wait for "Loading your cards…" to disappear. The dev stack's sample calendar has a meeting about to start ("Budget call with Ada") and one that just ended, so the first card is that meeting with "Why now: A meeting is about to start." Buttons by role and name: `getByRole("button", { name: "Not now" })`, `"Keep on top"`, `"Make it a task"`.

## Gotchas

The sample calendar is written relative to the stack's start time, so after about half an hour the "about to start" meeting has started and the first card changes. Restart the stack for a known first card. Acting on a card writes to the stack's data.
