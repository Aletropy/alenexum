import { defineComponent } from "../../../../src/index.js";

export const voteButtons = defineComponent({
  customId: "vote",
  async execute(ctx) {
    await ctx.reply(`voted ${ctx.args.join(":")}`);
  },
});

export default voteButtons;
