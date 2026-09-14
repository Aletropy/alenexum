---
title: Sharding
description: Coordinate discord.js sharding with validated options, per-shard logging, and timeout-guarded eval.
---

# Sharding

`@alenexum/sharding` coordinates discord.js `ShardingManager` — it does not implement sharding itself (sharding primitives remain a **discord.js responsibility**). Use it when a single process can no longer hold your guild count; until then, do not shard (see [Evolution](../architecture/evolution.md)).

```ts
import { resolveShardOptions, createShardingManager, ShardCoordinator } from "@alenexum/sharding";

const options = resolveShardOptions({
  token: process.env.DISCORD_TOKEN!,
  entry: "./dist/bot.js",
  totalShards: "auto",
  respawn: true,
});
// totalShards: "auto" | positive int. Bad counts / missing token / missing entry
// throw FRAMEWORK_INVALID_CONFIGURATION.

const manager = createShardingManager(options); // real discord.js ShardingManager, no spawn yet
const coordinator = new ShardCoordinator(manager, { logger: bot.logger });
const spawned: number = await coordinator.spawn();
const values = await coordinator.fetchValues((client) => client.guilds.cache.size);
```

`ShardCoordinator` provides: `spawn()` (with timeout and per-shard child loggers tagged `shardId`), `evalOnAll(fn)` (broadcast-eval with per-shard failure wrapping as `FRAMEWORK_SHARD_OPERATION_FAILED`), `fetchValues(fn)`, and `withTimeout`. Eval/shard timeouts and partial failures are reported with shard context — a failing shard never silently poisons the aggregate.

What this package does **not** do: cross-shard state, distributed caching, sticky routing, or deploy orchestration. Those are **infrastructure/application responsibilities** — see [Enterprise boundaries](../architecture/enterprise-boundaries.md).
