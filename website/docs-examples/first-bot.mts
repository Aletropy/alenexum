// Critical doc snippet: first bot + typed options (mirrors getting-started/first-bot).
// Typechecked in CI (website check:examples). Package imports resolve to
// workspace sources via docs-examples/tsconfig.json paths.
import { Bot, defineCommand, integerOption } from "@alenexum/core";

const ping = defineCommand({
  name: "ping",
  description: "Replies with Pong!",
  async execute(ctx) {
    await ctx.reply("Pong!");
  },
});

// Typed options require defineCommand: it infers ctx.options from the schema.
// (Inline bot.command({...}) accepts the same shape but without inference.)
const add = defineCommand({
  name: "add",
  description: "Add two numbers",
  options: {
    a: integerOption({ description: "First number", required: true }),
    b: integerOption({ description: "Second number", required: true }),
  },
  async execute(ctx) {
    const sum: number = ctx.options.a + ctx.options.b;
    await ctx.reply(`Result: ${sum}`);
  },
});

export function buildFirstBot(token: string): Bot {
  const bot = new Bot({ token });
  bot.command(ping);
  bot.command(add);
  return bot;
}
