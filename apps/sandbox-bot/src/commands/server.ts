import { defineCommand, requireGuild } from "@nexum/core";

export const serverCommand = defineCommand({
  name: "server",
  description: "Show the current guild id (guilds only)",
  guards: [requireGuild()],
  async execute(ctx) {
    await ctx.reply(`Guild ID: ${ctx.guildId ?? "unknown"}`);
  },
});

export default serverCommand;
