import "dotenv/config";
import { fileURLToPath } from "node:url";
import {
  Bot,
  createLogger,
  type FrameworkLogLevel,
  loadAutocomplete,
  loadCommands,
  loadComponents,
  loadContextMenus,
  loadMiddleware,
  loadModals,
} from "@alenexum/core";
import { createDiscordConnector } from "@alenexum/discord";
{{#jobs}}import { JobScheduler, jobsPlugin, loadJobs } from "@alenexum/jobs";
{{/jobs}}{{#telemetry}}import {
  createDispatchMetrics,
  discordClientCheck,
  HealthMonitor,
} from "@alenexum/telemetry";
{{/telemetry}}import { GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_TOKEN;
if (token === undefined || token.length === 0) {
  throw new Error(
    "DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.",
  );
}

const guildId = process.env.GUILD_ID;
const deployMode =
  (process.env.DEPLOY_MODE as "guild" | "global" | "skip" | undefined) ??
  (guildId !== undefined && guildId.length > 0 ? "guild" : "skip");
const logLevel =
  (process.env.LOG_LEVEL as FrameworkLogLevel | undefined) ?? "info";

{{#telemetry}}const metrics = createDispatchMetrics();
const health = new HealthMonitor();

{{/telemetry}}const bot = new Bot({
  token,
  logger: createLogger({
    level: logLevel,
    pretty: process.env.NODE_ENV !== "production",
  }),
{{#telemetry}}  observer: metrics.observer,
{{/telemetry}}});
{{#telemetry}}bot.services.register("metrics", metrics);
bot.services.register("health", health);
{{/telemetry}}{{#jobs}}const scheduler = new JobScheduler({
  logger: bot.logger.child({ subsystem: "jobs" }),
  services: bot.services,
});
bot.services.register("scheduler", scheduler);
{{/jobs}}
const src = (dir: string): string =>
  fileURLToPath(new URL(`./${dir}/`, import.meta.url));

await loadMiddleware(bot, src("middleware"));
await loadCommands(bot, src("commands"));
await loadComponents(bot, src("components"));
await loadModals(bot, src("modals"));
await loadAutocomplete(bot, src("autocomplete"));
await loadContextMenus(bot, src("context-menus"));
{{#jobs}}await loadJobs(scheduler, bot.logger, src("jobs"));
await bot.plugin(jobsPlugin(scheduler));
{{/jobs}}
const connector = createDiscordConnector(bot, {
  intents: {{intents}},
  deploy: { mode: deployMode, guildId },
});
bot.attachConnector(connector);
{{#telemetry}}health.register("discord", discordClientCheck(connector.client));
{{/telemetry}}
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  bot.logger.info(
    { subsystem: "bootstrap", event: "shutdown.signal" },
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
