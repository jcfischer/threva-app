# The desk

## Sub-features

A Studio topic: material, the assistant's notes, "Where I stand", and the way back.

## How to get to it (user POV)

From a Studio card on the Day ("A question in the Studio waits for your answer."), or from a topic in Everything, choose "Open the desk".

## Driving it with Playwright

No journey yet. Open with `getByRole("button", { name: "Open the desk" })`, prove "The assistant's notes" heading and the topic's material are shown, and return with "Back to the cards" or "Back to Everything".

## Gotchas

The first stack start creates `studio/` with two sample threads, one waiting on you. Later starts keep it; delete `studio/` in `THREVA_DEV_DIR` to get the samples back. Studio sessions need `THREVA_DEV_STUDIO_FILER`.
