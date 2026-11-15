# The desk

## Sub-features

A Studio topic: material, the assistant's notes, "Where I stand", and the way back.

## How to get to it (user POV)

From a Studio card on the Day ("A question in the Studio waits for your answer."), or from a topic in Everything, choose "Open the desk".

## Driving it with Playwright

`bun run verify:ui desk` opens the sample budget topic through Everything, checks the note's wide and stacked geometry, reveals Details, sends an answer through the real Studio endpoint, checks it appears in the middle, and opens material. It saves screenshots of each layout and the saved answer.

## Gotchas

The first stack start creates `studio/` with two sample threads, one waiting on you. Later starts keep it; delete `studio/` in `THREVA_DEV_DIR` to get the samples back. Studio sessions need `THREVA_DEV_STUDIO_FILER`.
