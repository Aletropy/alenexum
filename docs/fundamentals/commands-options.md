---
title: Commands and options
description: defineCommand, slash-name rules, the nine option types, type inference, and defense-in-depth parsing.
---

# Commands and options

## Defining a command

```ts
import { defineCommand, integerOption } from "@alenexum/core";

export default defineCommand({
  name: "add",
  description: "Add two numbers",
  options: {
    a: integerOption({ description: "First number", required: true }),
    b: integerOption({ description: "Second number", required: true }),
  },
  async execute(ctx) {
    await ctx.reply(`Result: ${ctx.options.a + ctx.options.b}`);
  },
});
```

`defineCommand` is an identity function with const-generics: it preserves literal names and infers `ctx.options` types from the schema. `bot.command(def)` also accepts the object inline. `CommandDefinition.execute` is declared as a method (bivariant) so handlers remain assignable.

Name rules (`assertValidCommandName`, `COMMAND_NAME_PATTERN`): `/^[\p{Ll}\p{N}_-]{1,32}$/u` — lowercase letters, numbers, `_`, `-`, 1–32 chars. Anything else throws `FRAMEWORK_INVALID_CONFIGURATION` at registration. (Context-menu names have looser rules — capitals and spaces allowed.)

## The nine option types

| Builder | Discord type | Inferred TS type |
|---|---|---|
| `stringOption` | string | `string` (+ choice literals when `choices` given) |
| `integerOption` | integer | `number` |
| `numberOption` | number | `number` |
| `booleanOption` | boolean | `boolean` |
| `userOption` | user | `ResolvedUser { id }` |
| `channelOption` | channel | `ResolvedChannel { id }` |
| `roleOption` | role | `ResolvedRole { id }` |
| `mentionableOption` | mentionable | `ResolvedMentionable { id }` |
| `attachmentOption` | attachment | `ResolvedAttachment { id, url }` |

Common facets: `description` (required, non-empty), `required`, `choices` (1–25, string/number), `minValue`/`maxValue` (numeric), `minLength`/`maxLength` (string), `autocomplete` (string, marks the option as autocomplete-driven). `required: true` infers a non-optional property; otherwise the property includes `| undefined`.

## Parsing: defense in depth

Discord validates at the edge, but the framework re-validates at dispatch via `parseOptions(raw, schema, { command, requestId })`:

- Missing required → wrong primitive type → min/max or length violations → unknown `choices` value → entity without a string `id` → attachment without `url` all throw `FRAMEWORK_COMMAND_VALIDATION_FAILED` (category `Validation`) with command + requestId context.
- Autocomplete contexts parse with `lenient: true`: partial input degrades to `undefined` instead of throwing, because the user is still typing.

## Deployment mapping

`@alenexum/discord` converts definitions to `SlashCommandBuilder` JSON (`toSlashCommandJSON`): all nine option types, `choices` count validation, `choices` + `autocomplete` mutual exclusion, and `defaultMemberPermissions` decimal-string validation. See [Deploy commands](../guides/deploy-commands.md).

Related: [Interactions](./interactions.md) · [API: core](../api/core.md).
