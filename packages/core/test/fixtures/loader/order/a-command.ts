import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "zzz",
  description: "Sorts after b-command by filename",
  async execute(ctx) {
    await ctx.reply("zzz");
  },
});
