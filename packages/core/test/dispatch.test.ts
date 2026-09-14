import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
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

function testBot() {
  const dest = new MemoryStream();
  const bot = new Bot({
    token: "test-token",
    logger: createLogger({ level: "debug", destination: dest }),
  });
  return { bot, dest };
}

function logLines(dest: MemoryStream): Record<string, unknown>[] {
  return dest.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("Bot.handleInteraction", () => {
  it("routes ping to its handler end-to-end (first milestone flow)", async () => {
    const { bot, dest } = testBot();
    const seen: string[] = [];
    bot.use(async (_ctx, next) => {
      seen.push("middleware");
      await next();
    });
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => {
        await ctx.reply("Pong!");
      },
    });

    const interaction = createFakeInteraction({ commandName: "ping" });
    const result = await bot.handleInteraction(interaction, {
      fakeClient: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command).toBe("ping");
      expect(typeof result.durationMs).toBe("number");
      expect(typeof result.requestId).toBe("string");
    }
    expect(interaction.replies).toEqual(["Pong!"]);
    expect(seen).toEqual(["middleware"]);

    const completed = logLines(dest).find((line) =>
      String(line.msg ?? "").includes("completed"),
    );
    expect(completed?.command).toBe("ping");
    expect(typeof completed?.durationMs).toBe("number");
    expect(typeof completed?.requestId).toBe("string");
  });

  it("runs per-command middleware after global middleware", async () => {
    const { bot } = testBot();
    const order: string[] = [];
    bot.use(async (_ctx, next) => {
      order.push("global");
      await next();
    });
    bot.command({
      name: "ping",
      description: "Ping",
      middleware: [
        async (_ctx, next) => {
          order.push("command");
          await next();
        },
      ],
      execute: async (ctx) => {
        order.push("handler");
        await ctx.reply("Pong!");
      },
    });
    const result = await bot.handleInteraction(createFakeInteraction());
    expect(result.ok).toBe(true);
    expect(order).toEqual(["global", "command", "handler"]);
  });

  it("returns FRAMEWORK_ROUTE_NOT_FOUND for unknown commands", async () => {
    const { bot, dest } = testBot();
    const result = await bot.handleInteraction(
      createFakeInteraction({ commandName: "nope" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
      expect(
        result.error.diagnostic?.suggestedInvestigation.length,
      ).toBeGreaterThan(0);
    }
    const failed = logLines(dest).find(
      (line) => line.event === "command.failed",
    );
    expect(failed?.command).toBe("nope");
    expect((failed?.error as { code?: string } | undefined)?.code).toBe(
      "FRAMEWORK_ROUTE_NOT_FOUND",
    );
  });

  it("wraps handler errors, logs them, and attempts user-facing recovery", async () => {
    const { bot, dest } = testBot();
    bot.command({
      name: "boom",
      description: "Always fails",
      execute: async () => {
        throw new Error("simulated handler failure");
      },
    });
    const interaction = createFakeInteraction({ commandName: "boom" });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
      expect(String(result.error.cause ?? result.error.message)).toContain(
        "simulated handler failure",
      );
    }
    // Best-effort recovery reply since the handler never acknowledged.
    expect(interaction.replies).toEqual([
      "Something went wrong while running that command.",
    ]);
    const failed = logLines(dest).find(
      (line) => line.event === "command.failed",
    );
    expect(failed?.command).toBe("boom");
    expect(typeof failed?.durationMs).toBe("number");
  });

  it("classifies double-ack as FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED", async () => {
    const { bot } = testBot();
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => {
        await ctx.reply("one");
        await ctx.reply("two");
      },
    });
    const interaction = createFakeInteraction();
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(
        "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
      );
    }
  });

  it("ignores non-command interactions without failing", async () => {
    const { bot } = testBot();
    const result = await bot.handleInteraction(
      createFakeInteraction({ chatInput: false }),
    );
    expect(result).toMatchObject({ ok: true, command: "" });
  });

  it("classifies Discord API shaped errors as DiscordAPI", async () => {
    const { bot } = testBot();
    const apiError = Object.assign(new Error("Unknown interaction"), {
      status: 404,
    });
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async () => {
        throw apiError;
      },
    });
    const result = await bot.handleInteraction(
      createFakeInteraction({ failReply: true }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.category).toBe("DiscordAPI");
    }
  });

  it("survives recovery failure when reply itself throws", async () => {
    const { bot } = testBot();
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async () => {
        throw new Error("handler down");
      },
    });
    const result = await bot.handleInteraction(
      createFakeInteraction({ failReply: true }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
    }
  });

  it("exposes services and escape hatches to handlers", async () => {
    const { bot } = testBot();
    bot.services.register("greeting", "hello");
    const seen: Record<string, unknown> = {};
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => {
        seen.greeting = ctx.services.get<string>("greeting");
        seen.hasInteraction = ctx.interaction !== undefined;
        seen.hasClient = ctx.client !== undefined;
        await ctx.reply("ok");
      },
    });
    const client = { fakeClient: true };
    const result = await bot.handleInteraction(createFakeInteraction(), client);
    expect(result.ok).toBe(true);
    expect(seen).toEqual({
      greeting: "hello",
      hasInteraction: true,
      hasClient: true,
    });
  });

  it("does not let middleware failures crash dispatch", async () => {
    const { bot } = testBot();
    bot.use(async () => {
      throw new Error("middleware down");
    });
    bot.command({ name: "ping", description: "Ping", execute: async () => {} });
    const result = await bot.handleInteraction(createFakeInteraction());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
    }
  });
});
