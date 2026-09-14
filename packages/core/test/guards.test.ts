import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import {
  DEFAULT_DENY_MESSAGE,
  defineGuard,
  normalizeGuard,
  runGuards,
} from "../src/guards.js";
import { createLogger } from "../src/logger.js";
import { createFakeInteraction } from "./helpers.js";

class MemoryStream extends Writable {
  lines: string[] = [];
  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(String(chunk));
    callback();
  }
}

function stubCtx(overrides: Record<string, unknown> = {}) {
  return {
    route: "test",
    requestId: "r1",
    interactionId: "i1",
    guildId: "g1",
    channelId: "c1",
    userId: "u1",
    logger: createLogger({ level: "silent" }),
    ...overrides,
  } as never;
}

describe("defineGuard / normalizeGuard", () => {
  it("preserves literal names", () => {
    const guard = defineGuard({ name: "admin", check: () => true });
    expect(guard.name).toBe("admin");
  });

  it("normalizes bare functions using the function name", () => {
    async function isAdmin(): Promise<boolean> {
      return true;
    }
    expect(normalizeGuard(isAdmin, "bot.guard()")).toEqual({
      name: "isAdmin",
      check: isAdmin,
    });
    expect(normalizeGuard(() => true, "bot.guard()").name).toBe("anonymous");
  });

  it("rejects malformed guards at registration", () => {
    expect(() => normalizeGuard({} as never, "bot.guard()")).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(() =>
      normalizeGuard({ name: "x", check: undefined } as never, "bot.guard()"),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(() => normalizeGuard(42 as never, "bot.guard()")).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });
});

describe("runGuards", () => {
  it("allows empty chains and boolean shorthands", async () => {
    expect(await runGuards([], stubCtx())).toEqual({
      allowed: true,
      guard: "",
      message: undefined,
    });
    expect(
      await runGuards([normalizeGuard(() => true, "t")], stubCtx()),
    ).toMatchObject({
      allowed: true,
    });
    expect(
      await runGuards([normalizeGuard(() => false, "t")], stubCtx()),
    ).toMatchObject({
      allowed: false,
    });
  });

  it("honors object results and stops at the first deny", async () => {
    const order: string[] = [];
    const decision = await runGuards(
      [
        normalizeGuard(
          defineGuard({
            name: "first",
            check: () => {
              order.push("first");
              return { allowed: false, message: "nope" };
            },
          }),
          "t",
        ),
        normalizeGuard(
          defineGuard({
            name: "second",
            check: () => {
              order.push("second");
              return true;
            },
          }),
          "t",
        ),
      ],
      stubCtx(),
    );
    expect(decision).toEqual({
      allowed: false,
      guard: "first",
      message: "nope",
    });
    expect(order).toEqual(["first"]);
  });

  it("propagates throwing checks as bugs", async () => {
    await expect(
      runGuards(
        [
          normalizeGuard(() => {
            throw new Error("guard bug");
          }, "t"),
        ],
        stubCtx(),
      ),
    ).rejects.toThrow("guard bug");
  });

  it("rejects garbage results", async () => {
    await expect(
      runGuards([normalizeGuard(() => "yes" as never, "t")], stubCtx()),
    ).rejects.toThrow(/invalid result/);
  });
});

describe("guard dispatch", () => {
  function guardedBot() {
    const dest = new MemoryStream();
    const bot = new Bot({
      token: "test-token",
      logger: createLogger({ level: "debug", destination: dest }),
    });
    return { bot, dest };
  }

  it("denies gracefully with a custom message and skips the handler", async () => {
    const { bot, dest } = guardedBot();
    let ran = false;
    bot.command({
      name: "ping",
      description: "Ping",
      guards: [
        defineGuard({
          name: "closed",
          check: () => ({ allowed: false, message: "closed beta" }),
        }),
      ],
      execute: async (ctx) => {
        ran = true;
        await ctx.reply("Pong!");
      },
    });
    const interaction = createFakeInteraction({ commandName: "ping" });
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "ping" });
    expect(ran).toBe(false);
    expect(interaction.replies).toEqual(["closed beta"]);
    const denied = dest.lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.event === "command.denied");
    expect(denied?.guard).toBe("closed");
    expect(denied?.command).toBe("ping");
  });

  it("uses the default deny message for boolean denies", async () => {
    const { bot } = guardedBot();
    bot.command({
      name: "ping",
      description: "Ping",
      guards: [() => false],
      execute: async () => {},
    });
    const interaction = createFakeInteraction({ commandName: "ping" });
    await bot.handleInteraction(interaction);
    expect(interaction.replies).toEqual([DEFAULT_DENY_MESSAGE]);
  });

  it("runs global guards before definition guards", async () => {
    const { bot } = guardedBot();
    const order: string[] = [];
    bot.guard(
      defineGuard({
        name: "global",
        check: () => {
          order.push("global");
          return true;
        },
      }),
    );
    bot.command({
      name: "ping",
      description: "Ping",
      guards: [
        defineGuard({
          name: "local",
          check: () => {
            order.push("local");
            return true;
          },
        }),
      ],
      execute: async (ctx) => {
        order.push("handler");
        await ctx.reply("ok");
      },
    });
    await bot.handleInteraction(createFakeInteraction({ commandName: "ping" }));
    expect(order).toEqual(["global", "local", "handler"]);
  });

  it("applies global guards to components and rejects bad registrations", async () => {
    const { bot } = guardedBot();
    bot.guard(() => ({ allowed: false, message: "frozen" }));
    const { defineComponent } = await import("../src/index.js");
    bot.component(
      defineComponent({
        customId: "vote",
        execute: async (ctx) => {
          await ctx.reply("counted");
        },
      }),
    );
    const interaction = createFakeInteraction({
      commandName: "unused",
      chatInput: false,
      customId: "vote",
      kinds: { button: true },
    });
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "vote" });
    expect(interaction.replies).toEqual(["frozen"]);

    expect(() => bot.guard(undefined as never)).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });

  it("turns throwing guards into handler failures", async () => {
    const { bot } = guardedBot();
    bot.command({
      name: "ping",
      description: "Ping",
      guards: [
        () => {
          throw new Error("guard bug");
        },
      ],
      execute: async () => {},
    });
    const result = await bot.handleInteraction(
      createFakeInteraction({ commandName: "ping" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
    }
  });
});
