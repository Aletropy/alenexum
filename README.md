# Alenexum

[![npm version](https://img.shields.io/npm/v/@alenexum/core.svg)](https://www.npmjs.com/package/@alenexum/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](./package.json)
[![CI](https://github.com/Aletropy/alenexum/actions/workflows/ci.yml/badge.svg)](https://github.com/Aletropy/alenexum/actions/workflows/ci.yml)

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
packages/testing    # Fakes + integration harness (dependency-free)
packages/telemetry  # Metrics, health checks (opt-in, zero deps)
packages/jobs       # Background jobs: scheduler, timeouts, overlap, lifecycle plugin
packages/sharding   # Lifecycle + typed eval over discord.js ShardingManager
packages/{commands,events,middleware,components,plugins,cli,all}
                    # Reserved stubs for later phases
apps/sandbox-bot    # Living stress harness (ping, boom, slow, middleware, shutdown)
tooling/            # Shared TypeScript config
```

## Installation

Requires Node >= 22.

```bash
npm install @alenexum/core @alenexum/discord
```

```bash
# testing (dev dependency)
npm install -D @alenexum/testing

# opt-in: observability, background jobs, sharding
npm install @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

With pnpm:

```bash
pnpm add @alenexum/core @alenexum/discord
pnpm add -D @alenexum/testing
pnpm add @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

Published packages: [`@alenexum/core`](https://www.npmjs.com/package/@alenexum/core),
[`@alenexum/discord`](https://www.npmjs.com/package/@alenexum/discord),
[`@alenexum/testing`](https://www.npmjs.com/package/@alenexum/testing),
[`@alenexum/telemetry`](https://www.npmjs.com/package/@alenexum/telemetry),
[`@alenexum/jobs`](https://www.npmjs.com/package/@alenexum/jobs),
[`@alenexum/sharding`](https://www.npmjs.com/package/@alenexum/sharding).

## Quick start

```ts
import { Bot } from "@alenexum/core";
import { createDiscordConnector } from "@alenexum/discord";
import { GatewayIntentBits } from "discord.js";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });

bot.command({
  name: "ping",
  description: "Ping",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

bot.attachConnector(
  createDiscordConnector(bot, {
    intents: [GatewayIntentBits.Guilds],
    deploy: { mode: "guild", guildId: process.env.GUILD_ID },
  }),
);

await bot.start();
```

See the [full documentation](./docs/intro.md) for guides, API reference, and production operations.

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
| `pnpm bench` | Hot-path benchmarks (`vitest bench`, informational, uncached) |
| `pnpm build` | tsup ESM + dts per package |
| `pnpm ci` | lint + typecheck + test + docs:check + build |

Requires Node >= 22 and pnpm >= 10.
