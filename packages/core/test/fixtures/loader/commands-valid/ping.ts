import { defineCommand } from "../../../../src/index.js";

export const pingCommand = defineCommand({
  name: "ping",
  description: "Ping",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

export default pingCommand;
