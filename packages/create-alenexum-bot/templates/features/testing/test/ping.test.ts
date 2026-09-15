import { Bot, createLogger } from "@alenexum/core";
import { dispatchChatInput } from "@alenexum/testing";
import { describe, expect, it } from "vitest";
import pingCommand from "../src/commands/ping.js";

describe("/ping", () => {
  it("replies with Pong!", async () => {
    const bot = new Bot({
      token: "test-token",
      logger: createLogger({ level: "silent" }),
    });
    bot.command(pingCommand);

    const { result, interaction } = await dispatchChatInput(bot, "ping");

    expect(result.ok).toBe(true);
    expect(interaction.replies).toEqual(["Pong!"]);
  });
});
