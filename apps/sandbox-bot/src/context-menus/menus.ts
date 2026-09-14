import { defineContextMenu } from "@discord-framework/core";

export const avatarMenu = defineContextMenu({
  type: "user",
  name: "Get avatar",
  async execute(ctx) {
    const user = ctx.targetUser as
      | { displayAvatarURL?: () => string }
      | undefined;
    await ctx.reply(
      user?.displayAvatarURL?.() ?? `User ID: ${ctx.targetId ?? "unknown"}`,
    );
  },
});

export const quoteMenu = defineContextMenu({
  type: "message",
  name: "Quote message",
  async execute(ctx) {
    const message = ctx.targetMessage as { content?: unknown } | undefined;
    const content =
      typeof message?.content === "string"
        ? message.content.slice(0, 500)
        : "(no text)";
    await ctx.reply(`> ${content}`);
  },
});
