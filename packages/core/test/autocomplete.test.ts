import { createFakeInteraction } from "@alenexum/testing";
import { describe, expect, it } from "vitest";
import {
  defineAutocomplete,
  extractFocusedOption,
} from "../src/autocomplete.js";
import { Bot } from "../src/bot.js";
import { defineCommand, stringOption } from "../src/index.js";
import { createLogger } from "../src/logger.js";

function testBot() {
  return new Bot({
    token: "test-token",
    logger: createLogger({ level: "silent" }),
  });
}

function autocompleteFake(
  commandName: string,
  focused: { name: string; value: string | number },
  optionValues: Record<string, unknown> = {},
) {
  return createFakeInteraction({
    commandName,
    chatInput: false,
    kinds: { autocomplete: true },
    focused,
    optionValues,
  });
}

const FRUITS = ["apple", "apricot", "banana"];

function fruitHandler() {
  return defineAutocomplete({
    command: "search",
    option: "query",
    execute: async (ctx) => {
      const matches = FRUITS.filter((fruit) =>
        fruit.startsWith(String(ctx.focused.value)),
      );
      await ctx.respond(
        matches.map((fruit) => ({ name: fruit, value: fruit })),
      );
    },
  });
}

describe("extractFocusedOption", () => {
  it("reads name and value", () => {
    const focused = extractFocusedOption(
      autocompleteFake("search", { name: "query", value: "ap" }),
      { command: "search", requestId: "r1" },
    );
    expect(focused).toEqual({ name: "query", value: "ap" });
  });

  it("throws a validation error without a resolver", () => {
    expect(() =>
      extractFocusedOption(
        { commandName: "search" },
        { command: "search", requestId: "r1" },
      ),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_COMMAND_VALIDATION_FAILED" }),
    );
  });
});

describe("Bot.handleInteraction autocomplete", () => {
  it("routes to the option-specific handler", async () => {
    const bot = testBot();
    bot.autocomplete(fruitHandler());
    const interaction = autocompleteFake("search", {
      name: "query",
      value: "ap",
    });
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "search" });
    expect(interaction.respondedChoices).toEqual([
      { name: "apple", value: "apple" },
      { name: "apricot", value: "apricot" },
    ]);
  });

  it("prefers option-specific over command-level handlers", async () => {
    const bot = testBot();
    const order: string[] = [];
    bot.autocomplete(
      defineAutocomplete({
        command: "search",
        execute: async (ctx) => {
          order.push("command-level");
          await ctx.respond([]);
        },
      }),
    );
    bot.autocomplete(fruitHandler());
    await bot.handleInteraction(
      autocompleteFake("search", { name: "query", value: "b" }),
    );
    expect(order).toEqual([]);
  });

  it("falls back to the command-level handler", async () => {
    const bot = testBot();
    bot.autocomplete(
      defineAutocomplete({
        command: "search",
        execute: async (ctx) => {
          await ctx.respond([{ name: ctx.focused.name, value: "fallback" }]);
        },
      }),
    );
    const interaction = autocompleteFake("search", {
      name: "other",
      value: "x",
    });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(true);
    expect(interaction.respondedChoices).toEqual([
      { name: "other", value: "fallback" },
    ]);
  });

  it("auto-responds [] when the handler stays silent", async () => {
    const bot = testBot();
    bot.autocomplete(
      defineAutocomplete({
        command: "search",
        option: "query",
        execute: async () => {},
      }),
    );
    const interaction = autocompleteFake("search", {
      name: "query",
      value: "z",
    });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(true);
    expect(interaction.respondedChoices).toEqual([]);
  });

  it("returns ROUTE_NOT_FOUND without a handler", async () => {
    const bot = testBot();
    const result = await bot.handleInteraction(
      autocompleteFake("search", { name: "query", value: "a" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
  });

  it("parses partial input leniently", async () => {
    const bot = testBot();
    bot.command(
      defineCommand({
        name: "search",
        description: "Search",
        options: {
          query: stringOption({ description: "q", required: true }),
          limit: stringOption({ description: "l", required: true }),
        },
        execute: async () => {},
      }),
    );
    let seen: unknown;
    bot.autocomplete(
      defineAutocomplete({
        command: "search",
        option: "query",
        execute: async (ctx) => {
          seen = { ...ctx.options };
          await ctx.respond([]);
        },
      }),
    );
    // Only the focused option is present; the other required option reads undefined, no throw.
    const interaction = autocompleteFake(
      "search",
      { name: "query", value: "a" },
      { query: "a" },
    );
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(true);
    expect(seen).toEqual({ query: "a", limit: undefined });
  });

  it("rejects oversized responses with a validation error", async () => {
    const bot = testBot();
    bot.autocomplete(
      defineAutocomplete({
        command: "search",
        option: "query",
        execute: async (ctx) => {
          await ctx.respond(
            Array.from({ length: 26 }, (_, index) => ({
              name: `c${index}`,
              value: index,
            })),
          );
        },
      }),
    );
    const result = await bot.handleInteraction(
      autocompleteFake("search", { name: "query", value: "a" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_COMMAND_VALIDATION_FAILED");
    }
  });

  it("rejects duplicate registrations", () => {
    const bot = testBot();
    bot.autocomplete(fruitHandler());
    expect(() => bot.autocomplete(fruitHandler())).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });
});
