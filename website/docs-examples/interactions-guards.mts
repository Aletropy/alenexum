// Critical doc snippets: middleware, guards, permissions, cooldowns, components,
// modals, autocomplete, context menus, modules, plugins (mirrors fundamentals + guides).
// Typechecked in CI (website check:examples).
import {
  type Bot,
  cooldown,
  defineAutocomplete,
  defineCommand,
  defineComponent,
  defineContextMenu,
  defineGuard,
  defineModal,
  defineModule,
  definePlugin,
  type Middleware,
  requireGuild,
  requireUserPermissions,
} from "@alenexum/core";
import { PermissionFlagsBits } from "discord.js";

export const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  ctx.logger.debug(
    { subsystem: "app", event: "interaction.received" },
    `Received "${ctx.route}"`,
  );
  await next();
  ctx.logger.debug(
    {
      subsystem: "app",
      event: "interaction.done",
      durationMs: Date.now() - start,
    },
    `Finished "${ctx.route}"`,
  );
};

export const auditGuard = defineGuard({
  name: "audit",
  check: (ctx) => {
    ctx.logger.debug(
      { subsystem: "audit", event: "audit.route" },
      `Route ${ctx.route}`,
    );
    return true;
  },
});

export const serverCommand = defineCommand({
  name: "server",
  description: "Server info",
  guards: [requireGuild()],
  async execute(ctx) {
    await ctx.reply(`Guild: ${ctx.guildId}`);
  },
});

export const banCommand = defineCommand({
  name: "ban",
  description: "Ban a member",
  guards: [
    requireGuild(),
    requireUserPermissions(PermissionFlagsBits.BanMembers),
  ],
  async execute(ctx) {
    await ctx.reply("banned");
  },
});

export const echoCommand = defineCommand({
  name: "echo",
  description: "Echo text",
  guards: [cooldown({ durationMs: 10_000 })],
  async execute(ctx) {
    await ctx.reply("echo");
  },
});

export const voteComponent = defineComponent({
  customId: "vote",
  type: "button",
  async execute(ctx) {
    const choice = ctx.args[0];
    await ctx.update(`You voted ${choice}`);
  },
});

export const feedbackModal = defineModal({
  customId: "feedback",
  async execute(ctx) {
    const message = ctx.fields.get("message");
    await ctx.reply(`Thanks! You wrote: ${message ?? "(empty)"}`);
  },
});

export const searchAutocomplete = defineAutocomplete({
  command: "search",
  option: "query",
  async execute(ctx) {
    const q = String(ctx.focused.value ?? "");
    await ctx.respond(
      ["apple", "apricot"]
        .filter((f) => f.startsWith(q))
        .map((f) => ({ name: f, value: f })),
    );
  },
});

export const avatarMenu = defineContextMenu({
  type: "user",
  name: "Get avatar",
  async execute(ctx) {
    await ctx.reply("avatar");
  },
});

export const greetingsModule = defineModule({
  name: "greetings",
  setup(host) {
    host.services.register("greeter", (name: string) => `Hello, ${name}!`);
    host.command({
      name: "hello",
      description: "Say hello",
      async execute(ctx) {
        const greet = ctx.services.get<(n: string) => string>("greeter");
        await ctx.reply(greet("world"));
      },
    });
  },
});

export const auditPlugin = definePlugin({
  name: "audit",
  setup(host) {
    host.guard(auditGuard);
  },
});

export function registerExamples(bot: Bot): void {
  bot.command(serverCommand);
  bot.command(banCommand);
  bot.command(echoCommand);
  bot.component(voteComponent);
  bot.modal(feedbackModal);
  bot.autocomplete(searchAutocomplete);
  bot.contextMenu(avatarMenu);
}
