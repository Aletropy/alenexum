import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import type { BaseInteractionContext } from "../src/context.js";
import { cooldown, MemoryCooldownStore } from "../src/cooldown.js";
import { FrameworkError } from "../src/errors.js";
import { createLogger } from "../src/logger.js";
import { createFakeInteraction } from "./helpers.js";

function stubCtx(
  overrides: Partial<BaseInteractionContext> = {},
): BaseInteractionContext {
  return {
    route: "ping",
    requestId: "r1",
    interactionId: "i1",
    guildId: "g1",
    channelId: "c1",
    userId: "u1",
    logger: createLogger({ level: "silent" }),
    services: undefined as never,
    interaction: undefined,
    client: undefined,
    ...overrides,
  };
}

describe("cooldown()", () => {
  it("rejects invalid durations at creation", () => {
    for (const durationMs of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "5" as never,
    ]) {
      expect(() => cooldown({ durationMs })).toThrowError(FrameworkError);
      try {
        cooldown({ durationMs });
      } catch (error) {
        expect((error as FrameworkError).code).toBe(
          "FRAMEWORK_INVALID_CONFIGURATION",
        );
      }
    }
  });

  it("allows first use, denies within the window, allows after expiry", async () => {
    let now = 0;
    const guard = cooldown({ durationMs: 5000, now: () => now });
    expect(await guard.check(stubCtx())).toBe(true);
    now = 100;
    const denied = await guard.check(stubCtx());
    expect(denied).toEqual({
      allowed: false,
      message: "Slow down — try again in 5s.",
    });
    now = 5000;
    expect(await guard.check(stubCtx())).toBe(true);
  });

  it("rounds the retry message up and supports custom messages", async () => {
    let now = 0;
    const guard = cooldown({ durationMs: 1500, now: () => now });
    expect(await guard.check(stubCtx())).toBe(true);
    now = 100;
    expect(await guard.check(stubCtx())).toEqual({
      allowed: false,
      message: "Slow down — try again in 2s.",
    });

    const custom = cooldown({
      durationMs: 60_000,
      now: () => 0,
      // A caller-supplied store governs its own clock: share it explicitly.
      store: new MemoryCooldownStore(10_000, () => 0),
      message: (seconds) => `wait ${seconds}s (custom)`,
    });
    expect(await custom.check(stubCtx())).toBe(true);
    expect(await custom.check(stubCtx())).toEqual({
      allowed: false,
      message: "wait 60s (custom)",
    });
    const staticMessage = cooldown({
      durationMs: 1000,
      now: () => 0,
      message: "nope",
    });
    expect(await staticMessage.check(stubCtx())).toBe(true);
    expect(await staticMessage.check(stubCtx())).toEqual({
      allowed: false,
      message: "nope",
    });
  });

  it("scopes by user by default and shares global buckets", async () => {
    const now = 0;
    const perUser = cooldown({ durationMs: 1000, now: () => now });
    expect(await perUser.check(stubCtx({ userId: "u1" }))).toBe(true);
    expect(await perUser.check(stubCtx({ userId: "u2" }))).toBe(true);
    expect(await perUser.check(stubCtx({ userId: "u1" }))).toMatchObject({
      allowed: false,
    });

    const global = cooldown({
      durationMs: 1000,
      scope: "global",
      now: () => now,
    });
    expect(await global.check(stubCtx({ userId: "u1" }))).toBe(true);
    expect(await global.check(stubCtx({ userId: "u2" }))).toMatchObject({
      allowed: false,
    });
  });

  it("isolates routes unless a shared key is set", async () => {
    const guard = cooldown({ durationMs: 1000, now: () => 0 });
    expect(await guard.check(stubCtx({ route: "a" }))).toBe(true);
    expect(await guard.check(stubCtx({ route: "b" }))).toBe(true);

    const shared = cooldown({ durationMs: 1000, key: "shared", now: () => 0 });
    expect(await shared.check(stubCtx({ route: "a" }))).toBe(true);
    expect(await shared.check(stubCtx({ route: "b" }))).toMatchObject({
      allowed: false,
    });
  });
});

describe("MemoryCooldownStore", () => {
  it("expires lazily, evicts oldest, and reports size", () => {
    const store = new MemoryCooldownStore(2);
    store.set("a", Date.now() + 60_000);
    store.set("b", Date.now() + 60_000);
    expect(store.size).toBe(2);
    store.set("c", Date.now() + 60_000);
    expect(store.size).toBe(2);
    expect(store.get("a")).toBeUndefined();
    store.set("expired", Date.now() - 1);
    expect(store.get("expired")).toBeUndefined();
    store.clear();
    expect(store.size).toBe(0);
  });
});

describe("cooldown dispatch", () => {
  it("runs the handler once then denies with the cooldown message", async () => {
    let now = 0;
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    let runs = 0;
    bot.command({
      name: "echo",
      description: "Echo",
      guards: [cooldown({ durationMs: 10_000, now: () => now })],
      execute: async (ctx) => {
        runs += 1;
        await ctx.reply("ok");
      },
    });
    const first = createFakeInteraction({ commandName: "echo" });
    expect(await bot.handleInteraction(first)).toMatchObject({ ok: true });
    expect(first.replies).toEqual(["ok"]);

    const second = createFakeInteraction({ commandName: "echo" });
    expect(await bot.handleInteraction(second)).toMatchObject({ ok: true });
    expect(second.replies).toEqual(["Slow down — try again in 10s."]);
    expect(runs).toBe(1);

    now = 10_000;
    const third = createFakeInteraction({ commandName: "echo" });
    expect(await bot.handleInteraction(third)).toMatchObject({ ok: true });
    expect(third.replies).toEqual(["ok"]);
    expect(runs).toBe(2);
  });
});
