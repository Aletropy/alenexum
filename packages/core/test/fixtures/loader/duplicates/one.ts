import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "ping",
  description: "First registration wins",
  async execute(ctx) {
    await ctx.reply("one");
  },
});
