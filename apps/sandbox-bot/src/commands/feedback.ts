import { defineCommand } from "@discord-framework/core";
import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export const feedbackCommand = defineCommand({
  name: "feedback",
  description: "Open the feedback form",
  async execute(ctx) {
    const interaction = ctx.interaction as ChatInputCommandInteraction;
    const modal = new ModalBuilder()
      .setCustomId("feedback")
      .setTitle("Feedback")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Your feedback")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
  },
});
