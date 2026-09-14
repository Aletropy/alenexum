import {
  createLogger,
  FrameworkError,
  type FrameworkLogger,
} from "@alenexum/core";
import { ShardingManager } from "discord.js";
import { z } from "zod";

/**
 * Sharding: lifecycle, typed cross-shard evaluation, and shard-aware
 * logging on top of discord.js `ShardingManager`. discord.js owns process
 * spawning, IPC, and shard state — this package only validates config,
 * classifies failures, bounds operations with timeouts, and keeps the
 * token out of logs.
 */

const ShardOptionsSchema = z.object({
  /** Explicit bot token (never env-sniffed, never logged). */
  token: z.string().min(1, "token must be a non-empty string"),
  /** Worker entry file spawned per shard. */
  entry: z.string().min(1, "entry must be a non-empty file path"),
  totalShards: z
    .union([z.number().int().positive(), z.literal("auto")])
    .default("auto"),
  respawn: z.boolean().default(true),
  shardArgs: z.array(z.string()).default([]),
  silent: z.boolean().default(false),
});

export type ShardManagerOptions = z.input<typeof ShardOptionsSchema>;
export type ResolvedShardOptions = z.output<typeof ShardOptionsSchema>;

/** Validate raw sharding config. Throws FRAMEWORK_INVALID_CONFIGURATION. */
export function resolveShardOptions(input: unknown): ResolvedShardOptions {
  const parsed = ShardOptionsSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
    );
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid sharding configuration: ${issues.join("; ")}`,
      context: { subsystem: "sharding", event: "config.validate" },
      diagnostic: {
        likelyCause:
          "The entry file or token is missing, or totalShards is invalid.",
        suggestedInvestigation: [
          "Pass an explicit token and the worker entry file.",
          "Use totalShards 'auto' or a positive integer.",
        ],
      },
    });
  }
  return parsed.data;
}

/** Construct a real discord.js ShardingManager from validated options. */
export function createShardingManager(
  options: ShardManagerOptions,
): ShardingManager {
  const resolved = resolveShardOptions(options);
  return new ShardingManager(resolved.entry, {
    token: resolved.token,
    totalShards: resolved.totalShards,
    respawn: resolved.respawn,
    shardArgs: resolved.shardArgs,
    silent: resolved.silent,
  });
}

/**
 * Structural subset of discord.js `ShardingManager` used by the
 * coordinator. Fakes implement this in tests; the real manager satisfies
 * it in production.
 */
export interface ShardInfo {
  readonly id: number;
  readonly ready: boolean;
}

export interface SpawnedShards {
  readonly size: number;
}

export interface ShardingManagerLike {
  readonly totalShards: number | "auto";
  spawn(options?: { timeout?: number }): Promise<SpawnedShards>;
  broadcastEval<T>(fn: (client: never) => T | Promise<T>): Promise<T[]>;
  fetchClientValues(prop: string): Promise<unknown[]>;
  on(event: "shardCreate", listener: (shard: ShardInfo) => void): unknown;
}

export interface ShardCoordinatorOptions {
  readonly logger?: FrameworkLogger | undefined;
  /** Bound for spawn(); discord.js default applies when omitted. */
  readonly spawnTimeoutMs?: number | undefined;
  /** Bound for eval/fetch operations. */
  readonly operationTimeoutMs?: number | undefined;
}

export class ShardCoordinator {
  private readonly logger: FrameworkLogger;
  private readonly spawnTimeoutMs: number | undefined;
  private readonly operationTimeoutMs: number;
  private wired = false;

  constructor(
    private readonly manager: ShardingManagerLike,
    options: ShardCoordinatorOptions = {},
  ) {
    this.logger = options.logger ?? createLogger({ level: "info" });
    this.spawnTimeoutMs = options.spawnTimeoutMs;
    this.operationTimeoutMs = options.operationTimeoutMs ?? 10_000;
  }

  get totalShards(): number | "auto" {
    return this.manager.totalShards;
  }

  /** Logger tagged for one shard (shardId flows into every structured line). */
  shardLogger(shardId: number): FrameworkLogger {
    return this.logger.child({ subsystem: "sharding", shardId });
  }

  /** Spawn all shards, wiring creation logging once. Returns the shard count. */
  async spawn(): Promise<number> {
    if (!this.wired) {
      this.wired = true;
      this.manager.on("shardCreate", (shard) => {
        this.shardLogger(shard.id).info(
          { event: "shard.created", shardId: shard.id },
          `Shard ${shard.id} created`,
        );
      });
    }
    const spawned = await this.withTimeout(
      this.manager.spawn(
        this.spawnTimeoutMs === undefined
          ? undefined
          : { timeout: this.spawnTimeoutMs },
      ),
      this.spawnTimeoutMs,
      "spawn",
    );
    this.logger.info(
      {
        subsystem: "sharding",
        event: "shards.spawned",
        command: `${spawned.size} shards`,
      },
      `Spawned ${spawned.size} shard(s)`,
    );
    return spawned.size;
  }

  /**
   * Evaluate `fn` on every shard and collect results. The function must be
   * self-contained (discord.js serializes it to workers).
   */
  async evalOnAll<T>(fn: (client: never) => T | Promise<T>): Promise<T[]> {
    try {
      return await this.withTimeout(
        this.manager.broadcastEval(fn),
        this.operationTimeoutMs,
        "broadcastEval",
      );
    } catch (error) {
      throw shardError("broadcastEval", error);
    }
  }

  /** Read one client property from every shard. */
  async fetchValues(prop: string): Promise<unknown[]> {
    try {
      return await this.withTimeout(
        this.manager.fetchClientValues(prop),
        this.operationTimeoutMs,
        `fetchClientValues(${prop})`,
      );
    } catch (error) {
      throw shardError(`fetchClientValues(${prop})`, error);
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number | undefined,
    operation: string,
  ): Promise<T> {
    if (timeoutMs === undefined) {
      return promise;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                shardError(
                  operation,
                  new Error(`timed out after ${timeoutMs}ms`),
                ),
              ),
            timeoutMs,
          );
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}

function shardError(operation: string, error: unknown): FrameworkError {
  if (error instanceof FrameworkError) {
    return error;
  }
  const message =
    error instanceof Error ? error.message : "Unknown shard error";
  return new FrameworkError({
    code: "FRAMEWORK_SHARD_OPERATION_FAILED",
    category: "Gateway",
    message: `Shard operation "${operation}" failed: ${message}`,
    context: { subsystem: "sharding", event: "shard.operation" },
    cause: error,
    diagnostic: {
      likelyCause:
        "A shard process crashed, timed out, or rejected the evaluation.",
      suggestedInvestigation: [
        "Check shard logs for crashes or login failures.",
        "Increase operationTimeoutMs for slow evaluations.",
        "Verify totalShards matches the deployment topology.",
      ],
    },
  });
}
