import { defineCommand } from "@nexum/core";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";

/**
 * Collector demo, composed — not reimplemented: discord.js owns the
 * collector, the framework owns the command and the quiet ack below.
 */
export const pollCommand = defineCommand({
  name: "poll",
  description: "First vote wins (15s collector window)",
  async execute(ctx) {
    const interaction = ctx.interaction as ChatInputCommandInteraction;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("poll:yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("poll:no")
        .setLabel("No")
        .setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
      content: "Poll (15s, first vote wins):",
      components: [row],
    });

    const channel = interaction.channel as unknown as
      | {
          awaitMessageComponent?: (options: unknown) => Promise<{
            customId: string;
            reply(message: string): Promise<unknown>;
          }>;
        }
      | undefined;
    if (typeof channel?.awaitMessageComponent !== "function") {
      await ctx.followUp("Collectors unavailable in this channel.");
      return;
    }
    try {
      const vote = await channel.awaitMessageComponent({
        filter: (candidate: unknown) =>
          typeof candidate === "object" &&
          candidate !== null &&
          String(
            (candidate as { customId?: unknown }).customId ?? "",
          ).startsWith("poll:"),
        time: 15_000,
      });
      await vote.reply(`First vote: ${vote.customId}`);
    } catch {
      await ctx.followUp("No votes in 15s.");
    }
  },
});

export default pollCommand;
