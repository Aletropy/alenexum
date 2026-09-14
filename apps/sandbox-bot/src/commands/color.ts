import { defineCommand } from "@alenexum/core";
import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  StringSelectMenuBuilder,
} from "discord.js";

export const colorCommand = defineCommand({
  name: "color",
  description: "Pick a color",
  async execute(ctx) {
    const interaction = ctx.interaction as ChatInputCommandInteraction;
    const menu = new StringSelectMenuBuilder()
      .setCustomId("color-pick")
      .setPlaceholder("Choose a color")
      .addOptions(
        { label: "Red", value: "red" },
        { label: "Green", value: "green" },
        { label: "Blue", value: "blue" },
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      menu,
    );
    await interaction.reply({ content: "Pick one:", components: [row] });
  },
});

export default colorCommand;
