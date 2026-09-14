import { defineCommand } from "@nexum/core";

/**
 * Intentional failure injection: exercises the framework error boundary,
 * structured error logs, and best-effort user-facing recovery.
 */
export const boomCommand = defineCommand({
  name: "boom",
  description: "Deliberately fails to exercise error handling",
  async execute() {
    throw new Error("Simulated command failure (sandbox failure injection)");
  },
});

/**
 * Slow-operation seed: defers, waits, then replies. Used to observe
 * graceful shutdown during in-flight work.
 */
export const slowCommand = defineCommand({
  name: "slow",
  description: "Replies after a deliberate delay",
  async execute(ctx) {
    await ctx.deferReply();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await ctx.followUp("Finally done (slow command).");
  },
});

export default [boomCommand, slowCommand];
