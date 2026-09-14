import { createFakeInteraction } from "@nexum/testing";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { defineContextMenu } from "../src/context-menu.js";
import { createLogger } from "../src/logger.js";

function testBot() {
  return new Bot({
    token: "test-token",
    logger: createLogger({ level: "silent" }),
  });
}

function menuFake(
  type: "user" | "message",
  name: string,
  extra: Record<string, unknown> = {},
) {
  return createFakeInteraction({
    commandName: name,
    chatInput: false,
    kinds: type === "user" ? { userMenu: true } : { messageMenu: true },
    ...extra,
  } as never);
}

describe("Bot.handleInteraction context menus", () => {
  it("routes user commands with target info", async () => {
    const bot = testBot();
    const seen: Record<string, unknown> = {};
    bot.contextMenu(
      defineContextMenu({
        type: "user",
        name: "Get avatar",
        execute: async (ctx) => {
          seen.menuType = ctx.menuType;
          seen.targetId = ctx.targetId;
          seen.hasTargetUser = ctx.targetUser !== undefined;
          await ctx.reply("avatar!");
        },
      }),
    );
    const interaction = menuFake("user", "Get avatar", {
      targetId: "u9",
      targetUser: { id: "u9" },
    });
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "Get avatar" });
    expect(seen).toEqual({
      menuType: "user",
      targetId: "u9",
      hasTargetUser: true,
    });
    expect(interaction.replies).toEqual(["avatar!"]);
  });

  it("routes message commands", async () => {
    const bot = testBot();
    bot.contextMenu(
      defineContextMenu({
        type: "message",
        name: "Count words",
        execute: async (ctx) => {
          const content = (
            ctx.targetMessage as { content?: unknown } | undefined
          )?.content;
          const words =
            typeof content === "string" && content.length > 0
              ? content.split(/\s+/).length
              : 0;
          await ctx.reply(`${words} words`);
        },
      }),
    );
    const interaction = menuFake("message", "Count words", {
      targetMessage: { content: "hello brave world" },
    });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(true);
    expect(interaction.replies).toEqual(["3 words"]);
  });

  it("returns ROUTE_NOT_FOUND for unregistered menus", async () => {
    const bot = testBot();
    const result = await bot.handleInteraction(menuFake("user", "Missing"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
  });

  it("allows spaces and capitals but rejects empty and overlong names", () => {
    const bot = testBot();
    bot.contextMenu(
      defineContextMenu({
        type: "user",
        name: "Get Avatar",
        execute: async () => {},
      }),
    );
    expect(bot.getContextMenuDefinitions()).toHaveLength(1);
    expect(() =>
      bot.contextMenu(
        defineContextMenu({ type: "user", name: "", execute: async () => {} }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(() =>
      bot.contextMenu(
        defineContextMenu({
          type: "user",
          name: "x".repeat(33),
          execute: async () => {},
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });

  it("keeps user and message namespaces separate", async () => {
    const bot = testBot();
    bot.contextMenu(
      defineContextMenu({
        type: "user",
        name: "Inspect",
        execute: async (ctx) => {
          await ctx.reply("user menu");
        },
      }),
    );
    // Same name as a message command is unregistered.
    const result = await bot.handleInteraction(menuFake("message", "Inspect"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
    bot.contextMenu(
      defineContextMenu({
        type: "message",
        name: "Inspect",
        execute: async (ctx) => {
          await ctx.reply("message menu");
        },
      }),
    );
    const ok = await bot.handleInteraction(menuFake("message", "Inspect"));
    expect(ok.ok).toBe(true);
  });
});
