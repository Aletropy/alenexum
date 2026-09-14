/**
 * `@alenexum/sharding` — lifecycle and typed evaluation over
 * discord.js `ShardingManager`. discord.js owns spawning, IPC, and shard
 * state; this package validates config, classifies failures, bounds
 * operations, and tags logs per shard.
 */

export {
  createShardingManager,
  type ResolvedShardOptions,
  resolveShardOptions,
  ShardCoordinator,
  type ShardCoordinatorOptions,
  type ShardInfo,
  type ShardingManagerLike,
  type ShardManagerOptions,
  type SpawnedShards,
} from "./sharding.js";
