import { describe, expect, it, vi } from "vitest";
import { Bot } from "../src/bot.js";
import type { Connector } from "../src/connector.js";
import { FrameworkError } from "../src/errors.js";
import { createLogger } from "../src/logger.js";

function silentBot(options: Record<string, unknown> = {}): Bot {
  return new Bot({
    token: "test-token",
    logger: createLogger({ level: "silent" }),
    ...options,
  });
}

function fakeConnector(overrides: Partial<Connector> = {}): {
  connector: Connector;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  return {
    connector: { name: "fake", start, stop, ...overrides },
    start,
    stop,
  };
}

describe("Bot lifecycle", () => {
  it("starts and stops with hooks in order", async () => {
    const bot = silentBot();
    const order: string[] = [];
    bot.on("beforeStart", () => void order.push("beforeStart"));
    bot.on("afterStart", () => void order.push("afterStart"));
    bot.on("beforeStop", () => void order.push("beforeStop"));
    bot.on("afterStop", () => void order.push("afterStop"));
    expect(bot.getStatus()).toBe("idle");
    await bot.start();
    expect(bot.getStatus()).toBe("ready");
    await bot.stop();
    expect(bot.getStatus()).toBe("stopped");
    expect(order).toEqual([
      "beforeStart",
      "afterStart",
      "beforeStop",
      "afterStop",
    ]);
  });

  it("starts and stops its connector", async () => {
    const { connector, start, stop } = fakeConnector();
    const bot = silentBot({ connector });
    await bot.start();
    expect(start).toHaveBeenCalledTimes(1);
    await bot.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("start is idempotent while ready", async () => {
    const { connector, start } = fakeConnector();
    const bot = silentBot({ connector });
    await bot.start();
    await bot.start();
    expect(start).toHaveBeenCalledTimes(1);
    await bot.stop();
  });

  it("stop is a no-op before start", async () => {
    await silentBot().stop();
  });

  it("aborts start when a hook fails and stays restartable", async () => {
    const bot = silentBot();
    bot.on("beforeStart", async () => {
      throw new Error("hook boom");
    });
    await expect(bot.start()).rejects.toMatchObject({
      code: "FRAMEWORK_LIFECYCLE_HOOK_FAILED",
    });
    expect(bot.getStatus()).toBe("idle");
  });

  it("wraps connector start failures with diagnostics", async () => {
    const { connector } = fakeConnector({
      start: vi.fn(async () => {
        throw new Error("login failed");
      }),
    });
    const bot = silentBot({ connector });
    await expect(bot.start()).rejects.toMatchObject({
      code: "FRAMEWORK_CONNECTOR_START_FAILED",
    });
    expect(bot.getStatus()).toBe("idle");
  });

  it("times out a hanging stop with FRAMEWORK_SHUTDOWN_TIMEOUT", async () => {
    const { connector } = fakeConnector({
      stop: vi.fn(() => new Promise<void>(() => {})),
    });
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
      connector,
      shutdownTimeoutMs: 20,
    });
    await bot.start();
    await expect(bot.stop()).rejects.toMatchObject({
      code: "FRAMEWORK_SHUTDOWN_TIMEOUT",
    });
    expect(bot.getStatus()).toBe("stopped");
  });

  it("loads plugins and surfaces setup failures", async () => {
    const bot = silentBot();
    await bot.plugin({
      name: "greeter",
      setup: (host) => {
        host.command({ name: "ping", description: "Ping", execute: () => {} });
        host.services.register("answer", 42);
      },
    });
    expect(bot.getCommandNames()).toEqual(["ping"]);
    expect(bot.services.get("answer")).toBe(42);

    await expect(
      bot.plugin({
        name: "broken",
        setup: () => {
          throw new Error("nope");
        },
      }),
    ).rejects.toMatchObject({ code: "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED" });
  });

  it("rejects invalid middleware and double connectors", () => {
    const bot = silentBot();
    expect(() => bot.use(undefined as never)).toThrowError(FrameworkError);
    bot.attachConnector(fakeConnector().connector);
    expect(() => bot.attachConnector(fakeConnector().connector)).toThrowError(
      FrameworkError,
    );
  });
});
