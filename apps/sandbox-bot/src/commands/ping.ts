import { defineCommand } from "@nexum/core";

export const pingCommand = defineCommand({
  name: "ping",
  description: "Replies with Pong!",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

export default pingCommand;
