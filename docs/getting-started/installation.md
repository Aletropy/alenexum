---
title: Installation
description: Requirements and workspace setup for Alenexum.
---

# Installation

## Requirements

- **Node.js >= 22**
- **pnpm >= 10** (the repo uses pnpm workspaces; `packageManager: pnpm@11.10.0`)
- A Discord application token (env-only, never committed)

## Install

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
| `pnpm ci` | lint + typecheck + test + build |
| `pnpm --filter sandbox-bot dev` | Run the sandbox bot (needs `DISCORD_TOKEN`) |

## Packages

Real, published-shape packages:

- `@alenexum/core` — Bot, routing, middleware, registries, config, logging, errors
- `@alenexum/discord` — discord.js transport adapter + REST command deployment
- `@alenexum/testing` — fakes + dispatch harness (zero dependencies, intentionally)
- `@alenexum/telemetry` — health checks + metrics (opt-in, zero required infra)
- `@alenexum/jobs` — background job scheduler + lifecycle plugin
- `@alenexum/sharding` — coordination over discord.js `ShardingManager`

Reserved for later phases (empty today, `export {}`): `@alenexum/commands`, `@alenexum/events`, `@alenexum/middleware`, `@alenexum/components`, `@alenexum/plugins`, `@alenexum/cli`, `@alenexum/all`. See [Reserved APIs](../api/reserved.md).

## Compatibility

See [Compatibility](../reference/compatibility.md) for the Node / discord.js / zod / TypeScript matrix.

Next: [Build your first bot](./first-bot.md).
