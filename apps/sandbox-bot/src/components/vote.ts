import { defineComponent } from "@alenexum/core";

const counts = new Map<string, number>([
  ["yes", 0],
  ["no", 0],
]);

/** Prefix registration: serves vote:yes, vote:no, … with args. */
export const voteButtons = defineComponent({
  customId: "vote",
  type: "button",
  async execute(ctx) {
    const choice = ctx.args[0] ?? "?";
    counts.set(choice, (counts.get(choice) ?? 0) + 1);
    await ctx.update(
      `Yes: ${counts.get("yes") ?? 0} — No: ${counts.get("no") ?? 0}`,
    );
  },
});

export default voteButtons;
