// Critical doc snippets: jobs, telemetry, observed-bot wiring (mirrors guides).
// Typechecked in CI (website check:examples).
import { Bot, createLogger } from "@alenexum/core";
import { defineJob, JobScheduler, jobsPlugin } from "@alenexum/jobs";
import {
  createDispatchMetrics,
  discordClientCheck,
  HealthMonitor,
} from "@alenexum/telemetry";

export const heartbeat = defineJob({
  name: "heartbeat",
  everyMs: 30_000,
  runOnStart: true,
  timeoutMs: 5_000,
  run: async (ctx) => {
    ctx.logger.info({ subsystem: "jobs", event: "heartbeat" }, "tick");
  },
});

export function buildObservedBot(token: string): {
  bot: Bot;
  scheduler: JobScheduler;
  health: HealthMonitor;
} {
  const metrics = createDispatchMetrics();
  const health = new HealthMonitor();
  const bot = new Bot({
    token,
    logger: createLogger({ level: "info" }),
    observer: metrics.observer,
  });
  bot.services.register("metrics", metrics);
  bot.services.register("health", health);
  const scheduler = new JobScheduler({
    logger: bot.logger.child({ subsystem: "jobs" }),
    services: bot.services,
  });
  bot.services.register("scheduler", scheduler);
  health.register("services", () => bot.services.has("metrics"));
  void discordClientCheck;
  void jobsPlugin;
  void heartbeat;
  return { bot, scheduler, health };
}
