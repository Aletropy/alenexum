import { defineComponent } from "@alenexum/core";

export const colorSelect = defineComponent({
  customId: "color-pick",
  type: "stringSelect",
  async execute(ctx) {
    await ctx.reply(`You picked: ${ctx.values.join(", ") || "(nothing)"}`);
  },
});

export default colorSelect;
