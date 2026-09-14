import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "ping",
  description: "Duplicate registration must fail",
  async execute(ctx) {
    await ctx.reply("two");
  },
});
