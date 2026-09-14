import { defineCommand } from "../../../../src/index.js";

export default defineCommand({
  name: "doomed",
  description: "Must never register: an earlier file fails first",
  async execute(ctx) {
    await ctx.reply("doomed");
  },
});
