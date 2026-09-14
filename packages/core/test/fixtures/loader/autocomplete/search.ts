import { defineAutocomplete } from "../../../../src/index.js";

export default defineAutocomplete({
  command: "search",
  option: "query",
  async execute(ctx) {
    await ctx.respond([
      { name: String(ctx.focused.value), value: String(ctx.focused.value) },
    ]);
  },
});
