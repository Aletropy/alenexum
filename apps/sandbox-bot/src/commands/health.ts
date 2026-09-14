import type { Bot } from "@alenexum/core";
import { defineCommand } from "@alenexum/core";
import type { HealthMonitor } from "@alenexum/telemetry";

export const healthCommand = defineCommand({
  name: "health",
  description: "Bot health report",
  async execute(ctx) {
    const monitor = ctx.services.get<HealthMonitor>("health");
    const bot = ctx.services.get<Bot>("bot");
    const report = await monitor.check();
    const lines = [
      `Status: ${report.status} (uptime ${Math.round(report.uptimeMs / 1000)}s, active ${bot.getActiveDispatchCount()})`,
      ...report.checks.map(
        (check) =>
          `- ${check.name}: ${check.status} (${check.latencyMs}ms)${check.message ? ` — ${check.message}` : ""}`,
      ),
    ];
    await ctx.reply(lines.join("\n"));
  },
});

export default healthCommand;
