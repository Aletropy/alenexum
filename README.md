# Discord Application Framework

TypeScript application framework for Discord bots — from tiny bots to enterprise-scale systems.

**Not** a discord.js replacement. Architecture:

```text
Application → Framework → discord.js / @discordjs/* → Discord
```

discord.js owns Gateway, REST, rate limits, caches, builders, and collectors.
This repo owns application architecture: lifecycle, routing, middleware,
registries, modules, plugins, config, logging, diagnostics, and testing.

## Layout

```text
packages/core       # Bot, lifecycle, config, errors, logger, registry, middleware, context, DI-lite
packages/discord    # Thin discord.js transport adapter (Connector) + REST command deployment
packages/{commands,events,middleware,components,plugins,testing,telemetry,sharding,cli,all}
                    # Reserved stubs for later phases
apps/sandbox-bot    # Living stress harness (ping, boom, slow, middleware, shutdown)
tooling/            # Shared TypeScript config
```

## Quick start

```ts
import { Bot } from "@discord-framework/core";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });
bot.command({
  name: "ping",
  description: "Ping",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});
await bot.start();
```

Run the sandbox bot (needs a real token, env-only — never commit one):

```bash
cp apps/sandbox-bot/.env.example apps/sandbox-bot/.env  # fill in DISCORD_TOKEN + GUILD_ID
pnpm install
pnpm --filter sandbox-bot dev
```

## Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | `tsc --noEmit` per package |
| `pnpm test` | Vitest per package |
| `pnpm build` | tsup ESM + dts per package |
| `pnpm ci` | lint + typecheck + test + build |

Requires Node >= 22 and pnpm >= 10.
