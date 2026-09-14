# `@nexum/sharding`

Lifecycle and typed evaluation over discord.js `ShardingManager`.
discord.js owns spawning, IPC, and shard state — this package validates
config, classifies failures, bounds operations with timeouts, and tags
logs per shard (`shardId` flows into every structured line).

```ts
import { ShardCoordinator, createShardingManager } from "@nexum/sharding";

const manager = createShardingManager({
  token: process.env.DISCORD_TOKEN!, // explicit only — never env-sniffed, never logged
  entry: "./bot.js",
  totalShards: "auto",
});
const shards = new ShardCoordinator(manager, { logger });
await shards.spawn();

const guildCounts = await shards.evalOnAll((client) => client.guilds.cache.size);
const uptimes = await shards.fetchValues("uptime");
```

- `evalOnAll(fn)` — `fn` must be self-contained (discord.js serializes it
  to workers). Failures and timeouts become
  `FRAMEWORK_SHARD_OPERATION_FAILED` (category `Gateway`).
- `spawnTimeoutMs` / `operationTimeoutMs` bound every call; unset spawn
  timeout defers to the discord.js default.
- In each worker, tag the bot logger: `logger.child({ shardId })` (or
  `coordinator.shardLogger(id)` in the parent).

## Non-goals

- No sharding protocol of our own (no gateway handling, no IPC design).
- No cross-shard stores or buses (deferred until a deployment needs them).
- `totalShards: "auto"` asks Discord for a recommendation at spawn.
