import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { createLogger } from "../src/logger.js";
import { createModalContext, defineModal } from "../src/modals.js";
import { ServiceContainer } from "../src/services.js";
import { createFakeInteraction } from "./helpers.js";

function testBot() {
  return new Bot({
    token: "test-token",
    logger: createLogger({ level: "silent" }),
  });
}

function modalFake(customId: string, fieldValues: Record<string, string> = {}) {
  return createFakeInteraction({
    commandName: "unused",
    chatInput: false,
    customId,
    kinds: { modal: true },
    fieldValues,
  });
}

describe("createModalContext fields", () => {
  it("reads submitted values and yields undefined for missing ones", () => {
    const ctx = createModalContext({
      interaction: modalFake("feedback", { message: "hello" }),
      customId: "feedback",
      args: [],
      logger: createLogger({ level: "silent" }),
      services: new ServiceContainer(),
      requestId: "r1",
    });
    expect(ctx.fields.get("message")).toBe("hello");
    expect(ctx.fields.get("absent")).toBeUndefined();
  });
});

describe("Bot.handleInteraction modals", () => {
  it("routes modal submits with prefix args", async () => {
    const bot = testBot();
    const seen: Record<string, unknown> = {};
    bot.modal(
      defineModal({
        customId: "feedback",
        execute: async (ctx) => {
          seen.args = [...ctx.args];
          seen.message = ctx.fields.get("message");
          await ctx.reply("thanks!");
        },
      }),
    );
    const interaction = modalFake("feedback:form1", { message: "great bot" });
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "feedback:form1" });
    expect(seen).toEqual({ args: ["form1"], message: "great bot" });
    expect(interaction.replies).toEqual(["thanks!"]);
  });

  it("returns ROUTE_NOT_FOUND for unknown modals", async () => {
    const bot = testBot();
    const result = await bot.handleInteraction(modalFake("nope"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
  });

  it("rejects invalid modal registrations", () => {
    const bot = testBot();
    expect(() =>
      bot.modal(defineModal({ customId: "", execute: async () => {} })),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    bot.modal(defineModal({ customId: "feedback", execute: async () => {} }));
    expect(() =>
      bot.modal(defineModal({ customId: "feedback", execute: async () => {} })),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });
});
