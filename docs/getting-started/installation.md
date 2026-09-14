---
title: Installation
description: Install published Alenexum packages from npm, or work from the monorepo.
---

# Installation

## Requirements

- **Node.js >= 22**
- A Discord application token (env-only, never committed)

## Install from npm

All packages are published as versioned ESM modules with TypeScript declarations:

```bash
npm install @alenexum/core @alenexum/discord
npm install -D @alenexum/testing
npm install @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

With pnpm:

```bash
pnpm add @alenexum/core @alenexum/discord
pnpm add -D @alenexum/testing
pnpm add @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

With yarn:

```bash
yarn add @alenexum/core @alenexum/discord
yarn add -D @alenexum/testing
yarn add @alenexum/telemetry @alenexum/jobs @alenexum/sharding
```

| Package | When you need it | npm |
|---|---|---|
| `@alenexum/core` | Always — Bot, routing, middleware, config, logging, errors | [npm](https://www.npmjs.com/package/@alenexum/core) |
| `@alenexum/discord` | Connecting to Discord + deploying commands | [npm](https://www.npmjs.com/package/@alenexum/discord) |
| `@alenexum/testing` | Unit/integration tests (dev dependency, zero deps) | [npm](https://www.npmjs.com/package/@alenexum/testing) |
| `@alenexum/telemetry` | Health checks + metrics (opt-in) | [npm](https://www.npmjs.com/package/@alenexum/telemetry) |
| `@alenexum/jobs` | Background jobs (opt-in) | [npm](https://www.npmjs.com/package/@alenexum/jobs) |
| `@alenexum/sharding` | Multi-process sharding (opt-in) | [npm](https://www.npmjs.com/package/@alenexum/sharding) |

Reserved for later phases (empty today, `export {}`, not published):
`@alenexum/commands`, `@alenexum/events`, `@alenexum/middleware`,
`@alenexum/components`, `@alenexum/plugins`, `@alenexum/cli`, `@alenexum/all`.
See [Reserved APIs](../api/reserved.md).

## Work from the monorepo

To contribute or run the sandbox bot, clone the repo (requires pnpm >= 10):

```bash
pnpm install
```

Useful commands (from the repo root):

| Command | What it does |
|---|---|
| `pnpm lint` | Biome check |
| `pnpm typecheck` | `tsc --noEmit` per package |
| `pnpm test` | Vitest per package |
| `pnpm bench` | Hot-path benchmarks (`vitest bench`, informational, uncached) |
| `pnpm build` | tsup ESM + dts per package |
| `pnpm ci` | lint + typecheck + test + docs:check + build |
| `pnpm --filter sandbox-bot dev` | Run the sandbox bot (needs `DISCORD_TOKEN`) |

## Compatibility

See [Compatibility](../reference/compatibility.md) for the Node / discord.js / zod / TypeScript matrix.

Next: [Build your first bot](./first-bot.md).
