import { defineCommand } from "@nexum/core";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";

export const voteCommand = defineCommand({
  name: "vote",
  description: "Start a yes/no vote",
  async execute(ctx) {
    // Rich message payloads go through the discord.js escape hatch;
    // the framework owns routing, not message construction.
    const interaction = ctx.interaction as ChatInputCommandInteraction;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("vote:yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("vote:no")
        .setLabel("No")
        .setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ content: "Vote!", components: [row] });
  },
});

export default voteCommand;
