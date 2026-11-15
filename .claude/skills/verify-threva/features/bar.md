# The bar

## Sub-features

Writing something down, asking a question, and suggestions while typing.

## How to get to it (user POV)

The text field under the title: "Write something down, or ask a question".

## Driving it with Playwright

No journey yet. Reach it with `getByPlaceholder("Write something down, or ask a question")`, type, and press Enter. Prove the result by the card or note it creates, not by the cleared field.

## Gotchas

Without `THREVA_DEV_PARSER_ROUTING` the bar uses Cortex's built-in rules; without `THREVA_DEV_LANES` a question cannot start a conversation.
