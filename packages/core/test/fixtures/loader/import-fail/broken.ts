import "./explodes.js";
import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "unreachable",
  description: "Import throws before this is evaluated",
  async execute(ctx) {
    await ctx.reply("unreachable");
  },
});
