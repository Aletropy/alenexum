import { defineContextMenu } from "../../../../src/index.js";

export default defineContextMenu({
  type: "user",
  name: "Inspect",
  async execute(ctx) {
    await ctx.reply(`inspecting ${ctx.targetId ?? "unknown"}`);
  },
});
