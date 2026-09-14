import { defineCommand } from "@nexum/core";
import type { JobScheduler } from "@nexum/jobs";

export const jobsCommand = defineCommand({
  name: "jobs",
  description: "Background job stats",
  async execute(ctx) {
    const scheduler = ctx.services.get<JobScheduler>("scheduler");
    const lines = scheduler.getNames().map((name) => {
      const status = scheduler.getStatus(name);
      return `- ${name}: runs=${status?.runs ?? 0} failures=${status?.failures ?? 0} skips=${status?.skips ?? 0} running=${status?.running === true ? "yes" : "no"}`;
    });
    await ctx.reply(lines.join("\n") || "(no jobs registered)");
  },
});

export default jobsCommand;
