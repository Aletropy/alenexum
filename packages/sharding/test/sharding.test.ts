import { createLogger, FrameworkError } from "@nexum/core";
import { LogCapture } from "@nexum/testing";
import { describe, expect, it } from "vitest";
import {
  createShardingManager,
  resolveShardOptions,
  ShardCoordinator,
  type ShardInfo,
  type ShardingManagerLike,
} from "../src/sharding.js";

class FakeManager implements ShardingManagerLike {
  totalShards: number | "auto" = 2;
  behavior: "ok" | "hang" | "fail" = "ok";
  readonly created: ShardInfo[] = [];
  private readonly listeners = new Map<
    string,
    ((shard: ShardInfo) => void)[]
  >();
  clients: Record<string, unknown>[] = [
    { id: "s0", guilds: 10 },
    { id: "s1", guilds: 20 },
  ];

  on(event: "shardCreate", listener: (shard: ShardInfo) => void): unknown {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  async spawn(): Promise<{ size: number }> {
    if (this.behavior === "hang") {
      await new Promise<void>(() => {});
    }
    if (this.behavior === "fail") {
      throw new Error("spawn failed");
    }
    for (const [index] of this.clients.entries()) {
      const shard = { id: index, ready: true };
      this.created.push(shard);
      for (const listener of this.listeners.get("shardCreate") ?? []) {
        listener(shard);
      }
    }
    return { size: this.clients.length };
  }

  async broadcastEval<T>(fn: (client: never) => T | Promise<T>): Promise<T[]> {
    if (this.behavior === "fail") {
      throw new Error("eval failed");
    }
    if (this.behavior === "hang") {
      await new Promise<void>(() => {});
    }
    return this.clients.map((client) => fn(client as never)) as T[];
  }

  async fetchClientValues(prop: string): Promise<unknown[]> {
    if (this.behavior === "fail") {
      throw new Error("fetch failed");
    }
    return this.clients.map((client) => client[prop]);
  }
}

describe("resolveShardOptions", () => {
  it("accepts minimal config with safe defaults", () => {
    expect(
      resolveShardOptions({ token: "t", entry: "./bot.js" }),
    ).toMatchObject({
      token: "t",
      entry: "./bot.js",
      totalShards: "auto",
      respawn: true,
      shardArgs: [],
      silent: false,
    });
  });

  it("rejects missing token/entry and bad shard counts", () => {
    expect(() => resolveShardOptions({ entry: "./bot.js" })).toThrowError(
      FrameworkError,
    );
    expect(() => resolveShardOptions({ token: "t" })).toThrowError(
      FrameworkError,
    );
    expect(() =>
      resolveShardOptions({ token: "t", entry: "./bot.js", totalShards: 0 }),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    try {
      resolveShardOptions({ entry: "./bot.js" });
    } catch (error) {
      expect((error as Error).message).not.toContain("secret");
    }
  });
});

describe("createShardingManager", () => {
  it("constructs a real discord.js manager without spawning", () => {
    // The constructor stats the entry file, so point at one that exists.
    const manager = createShardingManager({
      token: "test-token",
      entry: "package.json",
      totalShards: 2,
    });
    expect(manager.totalShards).toBe(2);
    expect(manager.respawn).toBe(true);
    expect(manager.file).toContain("package.json");
  });
});

describe("ShardCoordinator", () => {
  it("spawns and logs per-shard creation", async () => {
    const logs = new LogCapture();
    const manager = new FakeManager();
    const coordinator = new ShardCoordinator(manager, {
      logger: createLogger({ level: "debug", destination: logs }),
    });
    expect(coordinator.totalShards).toBe(2);
    await expect(coordinator.spawn()).resolves.toBe(2);
    const created = logs.events("shard.created");
    expect(created.map((line) => line.shardId)).toEqual([0, 1]);
    expect(logs.events("shards.spawned")).toHaveLength(1);
  });

  it("times out a hanging spawn", async () => {
    const manager = new FakeManager();
    manager.behavior = "hang";
    const coordinator = new ShardCoordinator(manager, {
      logger: createLogger({ level: "silent" }),
      spawnTimeoutMs: 20,
    });
    await expect(coordinator.spawn()).rejects.toMatchObject({
      code: "FRAMEWORK_SHARD_OPERATION_FAILED",
    });
  });

  it("evaluates across shards and wraps failures", async () => {
    const manager = new FakeManager();
    const coordinator = new ShardCoordinator(manager, {
      logger: createLogger({ level: "silent" }),
    });
    await expect(
      coordinator.evalOnAll((client) => (client as { guilds: number }).guilds),
    ).resolves.toEqual([10, 20]);

    manager.behavior = "fail";
    try {
      await coordinator.evalOnAll(() => 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FrameworkError);
      expect((error as FrameworkError).code).toBe(
        "FRAMEWORK_SHARD_OPERATION_FAILED",
      );
      expect((error as FrameworkError).category).toBe("Gateway");
    }
  });

  it("times out slow evaluations", async () => {
    const manager = new FakeManager();
    manager.behavior = "hang";
    const coordinator = new ShardCoordinator(manager, {
      logger: createLogger({ level: "silent" }),
      operationTimeoutMs: 20,
    });
    await expect(coordinator.evalOnAll(() => 1)).rejects.toMatchObject({
      code: "FRAMEWORK_SHARD_OPERATION_FAILED",
    });
  });

  it("fetches client values", async () => {
    const manager = new FakeManager();
    const coordinator = new ShardCoordinator(manager, {
      logger: createLogger({ level: "silent" }),
    });
    await expect(coordinator.fetchValues("guilds")).resolves.toEqual([10, 20]);
    manager.behavior = "fail";
    await expect(coordinator.fetchValues("guilds")).rejects.toMatchObject({
      code: "FRAMEWORK_SHARD_OPERATION_FAILED",
    });
  });

  it("tags loggers per shard", () => {
    const coordinator = new ShardCoordinator(new FakeManager(), {
      logger: createLogger({ level: "silent" }),
    });
    expect(coordinator.shardLogger(3)).toBeDefined();
  });
});
