import { defineAutocomplete } from "@alenexum/core";

const SUGGESTIONS = ["alpha", "beta", "gamma", "delta"];

/**
 * Reference example. Registration doesn't validate that the "example"
 * command/option pair exists, so this file is harmless as shipped — it
 * only becomes active once you add an autocomplete-enabled option to a
 * real command named "example" (or change `command`/`option` to match one
 * of your own).
 */
export const exampleAutocomplete = defineAutocomplete({
  command: "example",
  option: "query",
  async execute(ctx) {
    const input = String(ctx.focused.value).toLowerCase();
    const choices = SUGGESTIONS.filter((value) => value.startsWith(input)).map(
      (value) => ({ name: value, value }),
    );
    await ctx.respond(choices);
  },
});

export default exampleAutocomplete;
