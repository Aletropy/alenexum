import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "aaa",
  description: "Sorts before a-command by filename",
  async execute(ctx) {
    await ctx.reply("aaa");
  },
});
