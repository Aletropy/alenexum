import {
  booleanOption,
  cooldown,
  defineCommand,
  stringOption,
} from "@nexum/core";

export const echoCommand = defineCommand({
  name: "echo",
  description: "Replies with your input",
  options: {
    text: stringOption({
      description: "Text to echo",
      required: true,
      minLength: 1,
      maxLength: 500,
    }),
    shout: booleanOption({ description: "Uppercase the reply" }),
  },
  guards: [cooldown({ durationMs: 10_000 })],
  async execute(ctx) {
    const text =
      ctx.options.shout === true
        ? ctx.options.text.toUpperCase()
        : ctx.options.text;
    await ctx.reply(text);
  },
});

export default echoCommand;
