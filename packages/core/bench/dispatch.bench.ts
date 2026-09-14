/**
 * End-to-end dispatch benchmark: full handleInteraction through middleware,
 * guards, option parsing, handler, and structured logging (silent).
 */

import { createFakeInteraction } from "@nexum/testing";
import { bench, describe } from "vitest";
import { Bot, cooldown, defineCommand, integerOption } from "../src/index.js";
import { createLogger } from "../src/logger.js";

const bot = new Bot({
  token: "bench",
  logger: createLogger({ level: "silent" }),
});
bot.use(async (_ctx, next) => next());
bot.command(
  defineCommand({
    name: "add",
    description: "Add",
    options: {
      a: integerOption({ description: "a", required: true }),
      b: integerOption({ description: "b", required: true }),
    },
    guards: [cooldown({ durationMs: 60_000 })],
    execute: async (ctx) => {
      await ctx.reply(`${ctx.options.a + ctx.options.b}`);
    },
  }),
);

describe("dispatch", () => {
  let user = 0;
  bench(
    "handleInteraction with options + guard",
    async () => {
      // Unique user per iteration so the cooldown guard always passes
      // and every sample exercises the full handler path.
      user += 1;
      const interaction = createFakeInteraction({
        commandName: "add",
        optionValues: { a: 2, b: 3 },
        userId: `bench-user-${user}`,
      });
      await bot.handleInteraction(interaction);
    },
    { time: 1000 },
  );
});
