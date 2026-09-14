import { defineCommand } from "@nexum/core";
import type { DispatchMetrics } from "@nexum/telemetry";

export const statsCommand = defineCommand({
  name: "stats",
  description: "Dispatch metrics snapshot",
  async execute(ctx) {
    const metrics = ctx.services.get<DispatchMetrics>("metrics");
    const snapshot = metrics.registry.snapshot();
    const lines: string[] = [];
    for (const counter of snapshot.counters) {
      for (const sample of counter.samples) {
        const labels = Object.entries(sample.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(",");
        lines.push(`${counter.name}{${labels}} = ${sample.value}`);
      }
    }
    for (const histogram of snapshot.histograms) {
      for (const sample of histogram.samples) {
        const labels = Object.entries(sample.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(",");
        lines.push(`${histogram.name}{${labels}} count=${sample.count}`);
      }
    }
    const body = (lines.slice(0, 25).join("\n") || "(no dispatches yet)").slice(
      0,
      1800,
    );
    await ctx.reply(`\`\`\`\n${body}\n\`\`\``);
  },
});

export default statsCommand;
