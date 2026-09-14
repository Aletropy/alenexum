---
title: Interactions
description: Buttons and selects, modals, autocomplete, and context menus.
---

# Interactions

Slash commands are one of five interaction kinds. All five share the same pipeline (registry → guards → middleware → handler → error boundary); only the registry key and context shape differ.

## Components (buttons and selects)

```ts
import { defineComponent } from "@alenexum/core";

export default defineComponent({
  customId: "vote",
  type: "button", // enforced at dispatch
  async execute(ctx) {
    const choice = ctx.args[0]; // "vote:yes" → args ["yes"]
    await ctx.update(`You voted ${choice}`);
  },
});
```

- Routing uses `CustomIdRegistry` with **prefix matching**: an exact `customId` wins; otherwise the longest `:`-prefix is probed, and trailing segments become `ctx.args`. One definition serves a whole family (`vote`, `vote:yes`, `vote:no`).
- `customId` must be 1–100 chars (`assertValidCustomId`); duplicates throw `FRAMEWORK_INVALID_CONFIGURATION`.
- `type` (`button`, `stringSelect`, `userSelect`, `roleSelect`, `mentionableSelect`, `channelSelect`) is enforced: a button handler receiving a select interaction resolves `FRAMEWORK_ROUTE_NOT_FOUND`.
- `ctx.componentType` is detected structurally (`detectComponentType`, never throws; unknown shapes read as `"unknown"` or `"select"` for generic selects). `ctx.values` is populated only for string arrays (string selects).
- Per-definition `middleware` and `guards` work exactly like commands.

## Modals

```ts
import { defineModal } from "@alenexum/core";

export default defineModal({
  customId: "feedback",
  async execute(ctx) {
    const message = ctx.fields.get("message"); // string | undefined
    await ctx.reply(`Thanks! You wrote: ${message ?? "(empty)"}`);
  },
});
```

Same prefix routing as components. `ctx.fields.get(name)` wraps `getTextInputValue` and degrades throwing reads to `undefined`. Open the modal via the escape hatch (`showModal()` on the raw interaction) — see the sandbox `feedback` command.

## Autocomplete

```ts
import { defineAutocomplete } from "@alenexum/core";

export default defineAutocomplete({
  command: "search",
  option: "query", // omit for a command-level fallback
  async execute(ctx) {
    const q = String(ctx.focused.value ?? "");
    await ctx.respond(
      ["apple", "apricot", "avocado"].filter((f) => f.startsWith(q)).map((f) => ({ name: f, value: f })),
    );
  },
});
```

- The focused option is extracted via `options.getFocused(true)` (`extractFocusedOption`); malformed shapes throw `FRAMEWORK_COMMAND_VALIDATION_FAILED`.
- Registry key is `command\n option`: the option-specific handler wins, falling back to a command-level handler.
- `respond` validates ≤ 25 `{ name, value }` choices before forwarding. Guard denial auto-responds `[]`.
- A command with no handler at all resolves `FRAMEWORK_ROUTE_NOT_FOUND`.

## Context menus (user and message commands)

```ts
import { defineContextMenu } from "@alenexum/core";

export const menus = [
  defineContextMenu({
    type: "user",
    name: "Get avatar",
    async execute(ctx) {
      const user = ctx.targetUser as { displayAvatarURL?: () => string };
      await ctx.reply(user.displayAvatarURL?.() ?? "No avatar");
    },
  }),
];
```

Registry key is `type:name`; `user:X` and `message:X` are separate namespaces. Names allow capitals and spaces (1–32 chars) — unlike slash names. `ctx.targetUser` / `ctx.targetMessage` carry the raw targets (typed `unknown`; narrow at the boundary).

Related: [Context](./context.md) · [Middleware & guards](./middleware-guards.md) · [API: core](../api/core.md).
