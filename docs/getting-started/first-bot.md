---
title: Build your first bot
description: Tutorial — install, register a ping command, and start a Nexum bot.
---

# Build your first bot

This tutorial takes you from zero to a working bot that answers `/ping` with `Pong!`.

## 1. Configure the token

Nexum reads no config files for secrets. Pass the token from the environment:

```bash
export DISCORD_TOKEN="your-token-here"
```

`token` is validated by zod (`resolveConfig`) and is never logged — the logger redacts `token` paths by default.

## 2. Write the bot

```ts
import { Bot } from "@nexum/core";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });

bot.command({
  name: "ping",
  description: "Replies with Pong!",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

await bot.start();
```

What happened:

1. `new Bot({ token })` validates options (`FRAMEWORK_INVALID_CONFIGURATION` on a missing/empty token).
2. `bot.command(...)` validates the name (`COMMAND_NAME_PATTERN`: lowercase letters, numbers, `_`, `-`, 1–32 chars) and stores the definition in a `CommandRegistry` (`Map` lookup on the hot path).
3. `bot.start()` runs `beforeStart` hooks, starts the attached connector, then runs `afterStart` hooks.

## 3. Connect to Discord

Core never touches the network. Attach the discord.js adapter before `start()`:

```ts
import { Bot } from "@nexum/core";
import { createDiscordConnector } from "@nexum/discord";
import { GatewayIntentBits } from "discord.js";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });
bot.command({
  name: "ping",
  description: "Replies with Pong!",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

bot.attachConnector(
  createDiscordConnector(bot, {
    intents: [GatewayIntentBits.Guilds],
    deploy: { mode: "skip" },
  }),
);

await bot.start();
```

The connector wires `interactionCreate → bot.handleInteraction(interaction, client)` and owns `login`/`destroy`. Command deployment (`deployCommands`) is a separate explicit step — see [Deploy commands](../guides/deploy-commands.md).

## 4. Add a typed option

Typed options require `defineCommand` — it infers `ctx.options` from the schema. (Inline `bot.command({...})` accepts the same shape but without inference; `ctx.options` stays `Record<string, unknown>`.)

```ts
import { Bot, defineCommand, integerOption } from "@nexum/core";

const add = defineCommand({
  name: "add",
  description: "Add two numbers",
  options: {
    a: integerOption({ description: "First number", required: true }),
    b: integerOption({ description: "Second number", required: true }),
  },
  async execute(ctx) {
    // ctx.options.a and ctx.options.b are inferred as number
    await ctx.reply(`Result: ${ctx.options.a + ctx.options.b}`);
  },
});

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });
bot.command(add);
await bot.start();
```

Option schemas are validated twice: Discord validates at the edge, and `parseOptions` re-validates at dispatch (defense in depth). Failures surface as `FRAMEWORK_COMMAND_VALIDATION_FAILED`.

## 5. What to read next

- [Sandbox tour](./sandbox-tour.md) — run the full living example with 21 commands.
- [Application & lifecycle](../fundamentals/application-lifecycle.md) — start/stop, hooks, graceful shutdown.
- [Commands & options](../fundamentals/commands-options.md) — all 9 option types and type inference.
- [Testing](../guides/testing.md) — test this bot without connecting to Discord.
