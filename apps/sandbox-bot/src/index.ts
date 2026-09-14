import "dotenv/config";
import {
  Bot,
  createLogger,
  type FrameworkLogLevel,
} from "@discord-framework/core";
import { createDiscordConnector } from "@discord-framework/discord";
import { GatewayIntentBits } from "discord.js";
import { searchAutocomplete } from "./autocomplete/search.js";
import { addCommand } from "./commands/add.js";
import { boomCommand, slowCommand } from "./commands/boom.js";
import { colorCommand } from "./commands/color.js";
import { echoCommand } from "./commands/echo.js";
import { feedbackCommand } from "./commands/feedback.js";
import { pingCommand } from "./commands/ping.js";
import { searchCommand } from "./commands/search.js";
import { serverCommand } from "./commands/server.js";
import { userinfoCommand } from "./commands/userinfo.js";
import { voteCommand } from "./commands/vote.js";
import { colorSelect } from "./components/color.js";
import { voteButtons } from "./components/vote.js";
import { avatarMenu, quoteMenu } from "./context-menus/menus.js";
import { requestLogger } from "./middleware/request-logger.js";
import { feedbackModal } from "./modals/feedback.js";
import { greetingsModule } from "./modules/greetings.js";
import { auditPlugin } from "./plugins/audit.js";

const token = process.env.DISCORD_TOKEN;
if (token === undefined || token.length === 0) {
  throw new Error(
    "DISCORD_TOKEN is not set. Copy apps/sandbox-bot/.env.example to .env and fill it in.",
  );
}

const guildId = process.env.GUILD_ID;
const deployMode =
  (process.env.DEPLOY_MODE as "guild" | "global" | "skip" | undefined) ??
  (guildId !== undefined && guildId.length > 0 ? "guild" : "skip");
const logLevel =
  (process.env.LOG_LEVEL as FrameworkLogLevel | undefined) ?? "info";

const bot = new Bot({
  token,
  logger: createLogger({
    level: logLevel,
    pretty: process.env.NODE_ENV !== "production",
  }),
});

bot.use(requestLogger);
bot.command(pingCommand);
bot.command(addCommand);
bot.command(echoCommand);
bot.command(userinfoCommand);
bot.command(voteCommand);
bot.command(colorCommand);
bot.command(feedbackCommand);
bot.command(searchCommand);
bot.command(serverCommand);
bot.command(boomCommand);
bot.command(slowCommand);
bot.component(voteButtons);
bot.component(colorSelect);
bot.modal(feedbackModal);
bot.autocomplete(searchAutocomplete);
bot.contextMenu(avatarMenu);
bot.contextMenu(quoteMenu);
await bot.plugin(auditPlugin);
await bot.module(greetingsModule);

const connector = createDiscordConnector(bot, {
  intents: [GatewayIntentBits.Guilds],
  deploy: { mode: deployMode, guildId },
});
bot.attachConnector(connector);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  bot.logger.info(
    { subsystem: "sandbox", event: "shutdown.signal" },
    `Received ${signal}, shutting down`,
  );
  try {
    await bot.stop();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await bot.start();
await connector.deployCommands();
