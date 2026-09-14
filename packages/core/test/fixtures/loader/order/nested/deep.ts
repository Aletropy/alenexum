import { defineCommand } from "../../../../../src/index.js";

export default defineCommand({
  name: "nested",
  description: "Only visible with recursive: true",
  async execute(ctx) {
    await ctx.reply("nested");
  },
});
