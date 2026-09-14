import { defineCommand } from "../../../../src/index.js";

export default [
  defineCommand({
    name: "multi-one",
    description: "First",
    async execute(ctx) {
      await ctx.reply("one");
    },
  }),
  defineCommand({
    name: "multi-two",
    description: "Second",
    async execute(ctx) {
      await ctx.reply("two");
    },
  }),
];
