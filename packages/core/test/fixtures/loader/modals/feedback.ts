import { defineModal } from "../../../../src/index.js";

export default defineModal({
  customId: "feedback",
  async execute(ctx) {
    await ctx.reply(`got ${ctx.fields.get("message") ?? "nothing"}`);
  },
});
