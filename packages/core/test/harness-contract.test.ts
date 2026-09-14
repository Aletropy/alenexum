import {
  dispatchAutocomplete,
  dispatchButton,
  dispatchChatInput,
  dispatchContextMenu,
  dispatchModal,
  type TestBotLike,
} from "@nexum/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Bot } from "../src/bot.js";
import { createLogger } from "../src/logger.js";

/**
 * Contract: the real `Bot` satisfies the harness's structural surface, so
 * `@nexum/testing` can stay dependency-free without drifting.
 */
describe("testing harness contract", () => {
  function botWithAllKinds(): Bot {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => ctx.reply("Pong!"),
    });
    bot.component({
      customId: "vote",
      execute: async (ctx) => ctx.update("counted"),
    });
    bot.modal({
      customId: "form",
      execute: async (ctx) => ctx.reply(`got:${ctx.fields.get("message")}`),
    });
    bot.autocomplete({
      command: "search",
      option: "q",
      execute: async (ctx) => ctx.respond([{ name: "a", value: "a" }]),
    });
    bot.contextMenu({
      type: "user",
      name: "Hi",
      execute: async (ctx) => ctx.reply("hi"),
    });
    return bot;
  }

  it("Bot satisfies TestBotLike across every interaction kind", async () => {
    const bot = botWithAllKinds();
    const like: TestBotLike = bot;
    expectTypeOf(like.handleInteraction).toBeFunction();

    const chat = await dispatchChatInput(like, "ping");
    expect(chat.result).toMatchObject({ ok: true, command: "ping" });
    expect(chat.interaction.replies).toEqual(["Pong!"]);

    const button = await dispatchButton(like, "vote:yes");
    expect(button.result.ok).toBe(true);
    expect(button.interaction.updatedWith).toBe("counted");

    const modal = await dispatchModal(like, "form", { message: "hey" });
    expect(modal.result.ok).toBe(true);
    expect(modal.interaction.replies).toEqual(["got:hey"]);

    const auto = await dispatchAutocomplete(like, "search", {
      name: "q",
      value: "a",
    });
    expect(auto.result.ok).toBe(true);
    expect(auto.interaction.respondedChoices).toEqual([
      { name: "a", value: "a" },
    ]);

    const menu = await dispatchContextMenu(like, "user", "Hi");
    expect(menu.result.ok).toBe(true);
    expect(menu.interaction.replies).toEqual(["hi"]);
  });
});
