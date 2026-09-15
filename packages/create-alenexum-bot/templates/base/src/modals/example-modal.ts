import { defineModal } from "@alenexum/core";

/**
 * Reference example, not wired to any command. Open a modal with this
 * customId via discord.js's `ModalBuilder`/`TextInputBuilder` from a
 * command's interaction, then adapt or delete this file.
 */
export const exampleModal = defineModal({
  customId: "example-modal",
  async execute(ctx) {
    const input = ctx.fields.get("input") ?? "(empty)";
    await ctx.reply(`You submitted: ${input}`);
  },
});

export default exampleModal;
