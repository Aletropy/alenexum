---
title: "API: @nexum/sharding"
description: Sharding coordination over discord.js ShardingManager.
---

# API: `@nexum/sharding`

Depends on `@nexum/core`, `discord.js`, `zod`. Import from `@nexum/sharding`.

| Export | Kind | Notes |
|---|---|---|
| `resolveShardOptions(input)` | function | Validates `ShardOptionsSchema { token, entry, totalShards: "auto" \| positiveInt, respawn?, shardArgs?, silent? }`. Throws `FRAMEWORK_INVALID_CONFIGURATION`. |
| `ShardManagerOptions` / `ResolvedShardOptions` | types | zod input/output. |
| `createShardingManager(options)` | function | Returns a real discord.js `ShardingManager` (no spawn). |
| `ShardCoordinator` | class | `spawn(): Promise<number>`, `evalOnAll`, `fetchValues`, `withTimeout`, `shardLogger(shardId)`, `totalShards`. Per-shard child loggers; timeouts; failures wrapped as `FRAMEWORK_SHARD_OPERATION_FAILED`. |
| `ShardCoordinatorOptions` / `ShardInfo` / `SpawnedShards` / `ShardingManagerLike` | types | Structural seams for testing (bring a fake manager). |

**Limits:** coordination only — no shared state, sticky routing, or deploy orchestration. Guide: [Sharding](../guides/sharding.md).

## Export index

`resolveShardOptions`, `ResolvedShardOptions`, `ShardManagerOptions`, `createShardingManager`, `ShardCoordinator`, `ShardCoordinatorOptions`, `ShardInfo`, `SpawnedShards`, `ShardingManagerLike`.
