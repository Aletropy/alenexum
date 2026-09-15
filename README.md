# Alenexum

[![npm version](https://img.shields.io/npm/v/@alenexum/core.svg)](https://www.npmjs.com/package/@alenexum/core)
[![CI](https://github.com/matrovian/alenexum/actions/workflows/ci.yml/badge.svg)](https://github.com/matrovian/alenexum/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-matrovian.github.io%2Falenexum-blue)](https://matrovian.github.io/alenexum/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](./package.json)

**Alenexum** is a TypeScript application framework for Discord bots — from a weekend project to an enterprise-scale system, on the same architecture.

It is **not** a discord.js replacement:

```text
Application → Alenexum → discord.js / @discordjs/* → Discord
```

discord.js owns the Gateway, REST, rate limits, caches, builders, and collectors. Alenexum owns everything above that: lifecycle, routing, middleware, guards, registries, modules, plugins, configuration, structured logging, diagnostics, and testing. See [Enterprise boundaries](https://matrovian.github.io/alenexum/architecture/enterprise-boundaries) for the full responsibility matrix.

## Why Alenexum

- **Composition, not inheritance.** discord.js primitives are never reimplemented or hidden behind leaky abstractions — you keep the escape hatch to raw discord.js whenever you need it.
- **Explicit over magic.** Commands, middleware, components, and plugins are registered explicitly (or bulk-loaded from a directory convention); nothing is discovered implicitly at runtime.
- **Typed end-to-end.** Strict TypeScript, no `any` in public APIs, options and configuration validated at every boundary.
- **Production-first.** Structured logging with binding contracts, typed `FRAMEWORK_*` errors, graceful shutdown, opt-in metrics and health checks — see the [production checklist](https://matrovian.github.io/alenexum/guides/production).
- **Test without touching Discord.** `@alenexum/testing` ships dependency-free fakes and an integration harness — no network, no tokens, deterministic.
- **Pay only for what you use.** Telemetry, background jobs, and sharding are separate packages; a small bot's dependency tree stays small.

## Packages

| Package | Description |
| --- | --- |
| [`@alenexum/core`](https://www.npmjs.com/package/@alenexum/core) | `Bot`, lifecycle, routing, middleware, guards, registries, config (zod), structured errors, logger, DI-lite service container, directory loaders |
| [`@alenexum/discord`](https://www.npmjs.com/package/@alenexum/discord) | Thin discord.js transport adapter (`Connector`) + REST slash-command deployment |
| [`@alenexum/testing`](https://www.npmjs.com/package/@alenexum/testing) | Dependency-free fakes and an integration test harness |
| [`@alenexum/telemetry`](https://www.npmjs.com/package/@alenexum/telemetry) | Opt-in metrics and health checks, zero dependencies |
| [`@alenexum/jobs`](https://www.npmjs.com/package/@alenexum/jobs) | Background job scheduler — timeouts, overlap handling, lifecycle plugin |
| [`@alenexum/sharding`](https://www.npmjs.com/package/@alenexum/sharding) | Lifecycle and typed eval over discord.js's `ShardingManager` |
| [`create-alenexum-bot`](https://www.npmjs.com/package/create-alenexum-bot) | `npm create alenexum-bot` scaffolding CLI |

`packages/{commands,events,middleware,components,plugins,cli,all}` are reserved stubs for future phases — unpublished and export-free today; see [Reserved APIs](https://matrovian.github.io/alenexum/api/reserved).

## Quick start

The fastest way to start a new bot — scaffolds a project, prompts for name, options, and your Discord token:

```bash
npm create alenexum-bot@latest
```

To add Alenexum to an existing project instead:

```bash
npm install @alenexum/core @alenexum/discord

# testing (dev dependency)
npm install -D @alenexum/testing

# opt-in: observability, background jobs, sharding
npm install @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

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

## Documentation

The full guide — fundamentals, architecture, production operations, and API reference — is published at **[matrovian.github.io/alenexum](https://matrovian.github.io/alenexum/)**.

| Start here | |
| --- | --- |
| [Introduction](https://matrovian.github.io/alenexum/intro) | What Alenexum is and where it sits between your app, discord.js, and Discord |
| [Build your first bot](https://matrovian.github.io/alenexum/getting-started/first-bot) | Zero to a working `/ping` bot |
| [API reference](https://matrovian.github.io/alenexum/api/core) | Every public export of the six published packages |
| [Enterprise boundaries](https://matrovian.github.io/alenexum/architecture/enterprise-boundaries) | Responsibility matrix — what the framework owns vs. your application |

## Working in this repo

A pnpm + Turborepo monorepo. Requires **Node >= 22** and **pnpm >= 10**.

```bash
pnpm install
```

| Command | What it does |
| --- | --- |
| `pnpm lint` | Biome check across the workspace |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | Vitest in every package |
| `pnpm bench` | Hot-path benchmarks (`vitest bench`, informational, uncached) |
| `pnpm build` | `tsup` (ESM + `.d.ts`) in every package |
| `pnpm docs:start` / `docs:build` / `docs:check` | Docs site dev server / production build / API-coverage and example checks |
| `pnpm ci` | The full gate: lint + typecheck + test + docs:check + build |

Run the sandbox bot — a living stress harness exercising commands, components, jobs, and graceful shutdown (needs a real token, env-only, never committed):

```bash
cp apps/sandbox-bot/.env.example apps/sandbox-bot/.env  # fill in DISCORD_TOKEN + GUILD_ID
pnpm install
pnpm dev:sandbox
```

## Contributing

Dependency direction, coding standards, and the API-change process are documented in [Contributing](https://matrovian.github.io/alenexum/contributing). In short: reuse discord.js primitives rather than reimplementing them, validate every boundary, and every bugfix ships with a regression test.

## License

[MIT](./LICENSE) © matrovian
