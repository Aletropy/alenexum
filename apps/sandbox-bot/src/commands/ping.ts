import { defineCommand } from "@discord-framework/core";

export const pingCommand = defineCommand({
  name: "ping",
  description: "Replies with Pong!",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});
