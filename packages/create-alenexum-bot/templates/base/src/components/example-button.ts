import { defineComponent } from "@alenexum/core";

/**
 * Reference example, not wired to any command's reply. Attach a button
 * with this customId via discord.js's `ActionRowBuilder`/`ButtonBuilder`
 * from a command's `ctx.reply` (or a raw discord.js message payload), then
 * adapt or delete this file.
 */
export const exampleButton = defineComponent({
  customId: "example-button",
  type: "button",
  async execute(ctx) {
    await ctx.reply("Button clicked!");
  },
});

export default exampleButton;
