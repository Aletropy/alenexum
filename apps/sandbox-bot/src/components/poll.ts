import { defineComponent } from "@nexum/core";

/**
 * Quiet ack for poll buttons: the discord.js collector announces the result,
 * so the framework handler only acknowledges (no double reply).
 */
export const pollButtons = defineComponent({
  customId: "poll",
  type: "button",
  async execute(ctx) {
    await ctx.deferUpdate();
  },
});

export default pollButtons;
