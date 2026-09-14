---
title: "API: @alenexum/testing"
description: Fake interactions, dispatch harness, and log capture reference.
---

# API: `@alenexum/testing`

Zero dependencies (avoids a core cycle). Import from `@alenexum/testing`.

**Fakes** (`fakes.ts`): `FakeInteraction` (structural `isChatInputCommand/isButton/is*Select/isModalSubmit/isAutocomplete/is*ContextMenuCommand`, reply/defer/followUp/update/deferUpdate/respond recording), `FakeOptionResolver` (all getters + `getFocused`), `FakeInteractionOptions`, `NonCommandOptions`, factories `createFakeInteraction`, `chatInputInteraction`, `buttonInteraction`, `selectInteraction`, `modalInteraction`, `autocompleteInteraction`, `contextMenuInteraction`.

**Harness** (`harness.ts`): `TestBotLike` (structural `{ handleInteraction }` — `Bot satisfies` it), `TestDispatchResult`, `Dispatched { result, interaction }`, `dispatchChatInput/Button/Modal/Autocomplete/ContextMenu(bot, …)`, `LogCapture extends Writable` (`text()`, `lines()`, `events(name)`, `clear()`).

**When to use:** every command/guard/middleware/component/modal/autocomplete/menu test. **When not to use:** production code — never ship fakes.

Guide: [Testing](../guides/testing.md).

## Export index

`FakeInteraction`, `FakeInteractionOptions`, `FakeOptionResolver`, `NonCommandOptions`, `createFakeInteraction`, `chatInputInteraction`, `buttonInteraction`, `selectInteraction`, `modalInteraction`, `autocompleteInteraction`, `contextMenuInteraction`, `TestBotLike`, `TestDispatchResult`, `Dispatched`, `LogCapture`, `dispatchChatInput`, `dispatchButton`, `dispatchModal`, `dispatchAutocomplete`, `dispatchContextMenu`.
