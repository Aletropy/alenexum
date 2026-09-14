---
title: Context
description: Interaction contexts, reply semantics, and the discord.js escape hatches.
---

# Context

Every handler receives a **context**: a small, purpose-built facade over the raw interaction. Contexts carry routing info, typed accessors, ack-tracked reply methods, the logger, services, and the escape hatches.

## Common base

`BaseInteractionContext` (all kinds):

```ts
interface BaseInteractionContext {
  route: string;            // command name, customId, or menu name
  interactionId: string | null;
  guildId: string | null;
  channelId: string | null;
  userId: string | null;
  requestId: string;        // minted per dispatch, propagate it
  logger: FrameworkLogger;  // child logger pre-bound with route + requestId
  services: ServiceContainer;
  interaction: unknown;     // escape hatch: the raw discord.js interaction
  client: unknown;          // escape hatch: the discord.js Client
}
```

IDs are best-effort (`extractInteractionIds` never throws; missing values are `null`). Probes (`isChatInputCommandInteraction`, `interactionFlag`) are also total — a missing or throwing method reads as `false`.

## Per-kind contexts

| Kind | Extra fields | Reply methods |
|---|---|---|
| `CommandContext<TOptions>` | `commandName`, `options` (typed) | `reply`, `deferReply`, `followUp`, `update`, `deferUpdate` |
| `ComponentContext` | `customId`, `args` (prefix segments), `componentType`, `values` (selects) | same five |
| `ModalContext` | `customId`, `args`, `fields.get(name)` | same five |
| `AutocompleteContext` | `commandName`, `focused { name, value }`, `options` (lenient), `respond(choices)` | `respond` only |
| `ContextMenuContext` | `menuType`, `targetId`, `targetUser`, `targetMessage` | same five |

## Reply semantics (ack tracking)

`reply` / `deferReply` / `update` / `deferUpdate` share one **acknowledged** flag; `followUp` is exempt (it requires a prior ack). Only methods present on the raw interaction are wired; calling a missing one throws `FRAMEWORK_INTERNAL`.

- Double-ack (e.g. `reply` then `reply`, or `reply` then `update`) throws `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED` (category `DiscordAPI`) with a `likelyCause` diagnostic. This is fail-fast, not silent — the sandbox `/dupe` command demonstrates it live.
- Only `followUp` may be called multiple times (see `/flood`).
- Autocomplete uses `respond(choices)` instead: at most 25 choices, each `{ name: string, value: string | number }`, validated before forwarding. Violations throw `FRAMEWORK_COMMAND_VALIDATION_FAILED`; a missing raw `respond` throws `FRAMEWORK_INTERNAL`.

## Escape hatches

```ts
import type { ChatInputCommandInteraction } from "discord.js";

bot.command({
  name: "vote",
  description: "Vote with buttons",
  async execute(ctx) {
    const interaction = ctx.interaction as ChatInputCommandInteraction;
    await interaction.reply({ content: "Pick one", components: [row] });
  },
});
```

Use the hatch for builders, collectors (`awaitMessageComponent`), `showModal()`, and anything without a framework wrapper. Never wait for a wrapper — the hatch is the supported path, and the sandbox (`vote`, `color`, `feedback`, `poll`) proves it.

:::warning Discord deadlines
You have ~3 seconds to acknowledge an interaction (`reply`, `deferReply`, `update`, `deferUpdate`, or autocomplete `respond`). For slow work, `deferReply()` first, then `followUp()`. The `/slow` sandbox command demonstrates the pattern.
:::

Related: [Commands & options](./commands-options.md) · [Interactions](./interactions.md).
