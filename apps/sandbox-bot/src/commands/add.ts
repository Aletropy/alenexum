import { defineCommand, integerOption } from "@alenexum/core";

export const addCommand = defineCommand({
  name: "add",
  description: "Adds two numbers",
  options: {
    a: integerOption({ description: "First number", required: true }),
    b: integerOption({ description: "Second number", required: true }),
  },
  async execute(ctx) {
    await ctx.reply(
      `${ctx.options.a} + ${ctx.options.b} = ${ctx.options.a + ctx.options.b}`,
    );
  },
});

export default addCommand;
