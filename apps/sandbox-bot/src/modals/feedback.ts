import { defineModal } from "@discord-framework/core";

export const feedbackModal = defineModal({
  customId: "feedback",
  async execute(ctx) {
    await ctx.reply(
      `Thanks! You wrote: ${ctx.fields.get("message") ?? "(empty)"}`,
    );
  },
});
