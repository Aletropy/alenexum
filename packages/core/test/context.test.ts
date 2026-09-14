import { describe, expect, it } from "vitest";
import {
  createCommandContext,
  isChatInputCommandInteraction,
} from "../src/context.js";
import { FrameworkError } from "../src/errors.js";
import { createLogger } from "../src/logger.js";
import { ServiceContainer } from "../src/services.js";
import { createFakeInteraction } from "./helpers.js";

function setup(interaction: unknown) {
  return createCommandContext({
    interaction,
    client: { fake: true },
    logger: createLogger({ level: "silent" }),
    services: new ServiceContainer(),
    requestId: "req-1",
  });
}

describe("command context", () => {
  it("exposes ids, escape hatches, and requestId", () => {
    const interaction = createFakeInteraction({
      commandName: "ping",
      userId: "u9",
    });
    const ctx = setup(interaction);
    expect(ctx.commandName).toBe("ping");
    expect(ctx.interactionId).toBe("interaction-1");
    expect(ctx.guildId).toBe("guild-1");
    expect(ctx.channelId).toBe("channel-1");
    expect(ctx.userId).toBe("u9");
    expect(ctx.requestId).toBe("req-1");
    expect(ctx.interaction).toBe(interaction);
    expect(ctx.client).toEqual({ fake: true });
  });

  it("delegates reply/defer/followUp to the interaction", async () => {
    const interaction = createFakeInteraction();
    const ctx = setup(interaction);
    await ctx.reply("Pong!");
    await ctx.followUp("after");
    expect(interaction.replies).toEqual(["Pong!"]);
    expect(interaction.followUps).toEqual(["after"]);
    await setup(createFakeInteraction()).deferReply();
  });

  it("rejects double reply with FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED", async () => {
    const ctx = setup(createFakeInteraction());
    await ctx.reply("first");
    await expect(ctx.reply("second")).rejects.toMatchObject({
      code: "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
    });
  });

  it("rejects defer after reply", async () => {
    const ctx = setup(createFakeInteraction());
    await ctx.reply("first");
    await expect(ctx.deferReply()).rejects.toBeInstanceOf(FrameworkError);
  });

  it("rejects interactions without a commandName", () => {
    expect(() => setup({})).toThrowError(FrameworkError);
    expect(() => setup(null)).toThrowError(FrameworkError);
  });

  it("isChatInputCommandInteraction handles discord.js and fakes", () => {
    expect(isChatInputCommandInteraction(createFakeInteraction())).toBe(true);
    expect(
      isChatInputCommandInteraction({ isChatInputCommand: () => true }),
    ).toBe(true);
    expect(
      isChatInputCommandInteraction({ isChatInputCommand: () => false }),
    ).toBe(false);
    expect(isChatInputCommandInteraction({ commandName: "x" })).toBe(true);
    expect(isChatInputCommandInteraction(null)).toBe(false);
    expect(isChatInputCommandInteraction("nope")).toBe(false);
  });
});
