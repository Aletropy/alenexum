import { defineCommand, stringOption } from "@nexum/core";

export const searchCommand = defineCommand({
  name: "search",
  description: "Search fruits with autocomplete",
  options: {
    query: stringOption({
      description: "Fruit prefix",
      required: true,
      autocomplete: true,
    }),
  },
  async execute(ctx) {
    await ctx.reply(`You searched for: ${ctx.options.query}`);
  },
});

export default searchCommand;
