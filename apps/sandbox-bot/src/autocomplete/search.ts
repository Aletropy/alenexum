import { defineAutocomplete } from "@alenexum/core";

const FRUITS = ["apple", "apricot", "avocado", "banana", "blueberry", "cherry"];

export const searchAutocomplete = defineAutocomplete({
  command: "search",
  option: "query",
  async execute(ctx) {
    const prefix = String(ctx.focused.value).toLowerCase();
    const matches = FRUITS.filter((fruit) => fruit.startsWith(prefix)).slice(
      0,
      25,
    );
    await ctx.respond(matches.map((fruit) => ({ name: fruit, value: fruit })));
  },
});

export default searchAutocomplete;
