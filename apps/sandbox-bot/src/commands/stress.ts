import { defineCommand } from "@nexum/core";

/** Concurrency seed: one defer plus five parallel follow-ups. */
export const floodCommand = defineCommand({
  name: "flood",
  description: "Sends 5 concurrent follow-ups",
  async execute(ctx) {
    await ctx.deferReply();
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        ctx.followUp(`burst ${index + 1}/5`),
      ),
    );
  },
});

/** Long-operation seed: exceeds nothing, but exercises shutdown mid-flight. */
export const timeoutCommand = defineCommand({
  name: "timeout",
  description: "Works for 8s after deferring",
  async execute(ctx) {
    await ctx.deferReply();
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await ctx.followUp("Done after 8s.");
  },
});

/**
 * Double-ack injection: the second reply throws
 * FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED inside the error boundary.
 */
export const dupeCommand = defineCommand({
  name: "dupe",
  description: "Deliberately double-acks to demo the error boundary",
  async execute(ctx) {
    await ctx.reply("first");
    await ctx.reply("second");
  },
});

export default [floodCommand, timeoutCommand, dupeCommand];
