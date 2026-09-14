---
title: Small applications
description: One process, a few commands, simple config — the honest starting point.
---

# Small applications

```text
Bot
└── Commands (inline bot.command calls)
```

One process, a handful of commands, `deploy: { mode: "skip" }` or dev-guild deploy, default in-memory everything. No modules, no plugins, no jobs, no metrics — add them when you feel the need, not before.

```ts
import { Bot } from "@alenexum/core";
import { createDiscordConnector } from "@alenexum/discord";
import { GatewayIntentBits } from "discord.js";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });
bot.command({ name: "ping", description: "Ping", async execute(ctx) { await ctx.reply("Pong!"); } });
bot.attachConnector(createDiscordConnector(bot, { intents: [GatewayIntentBits.Guilds] }));
await bot.start();
```

- **Structure:** single entry file. Split when it exceeds ~200 lines or two concerns share the file.
- **Deploy:** dev-guild `guild` mode while iterating; `skip` is fine until Discord needs the definitions.
- **Tests:** one dispatch test per command (`dispatchChatInput`).
- **Logging:** default logger; `pretty: true` locally, JSON in production.

**Signals to grow** (→ [Growing](./growing-app.md)): repeated service lookups, copy-pasted guards/middleware, command files importing each other, or any shared state.
