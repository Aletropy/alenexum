import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCommand } from "../src/index.js";

describe("defineCommand", () => {
  it("returns the definition unchanged", () => {
    const def = {
      name: "ping",
      description: "Ping",
      execute: async () => {},
    } as const;
    expect(defineCommand(def)).toBe(def);
  });

  it("preserves literal types for inference", () => {
    const command = defineCommand({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => {
        expectTypeOf(ctx.commandName).toEqualTypeOf<string>();
        expectTypeOf(ctx.requestId).toEqualTypeOf<string>();
        await ctx.reply("Pong!");
      },
    });
    expectTypeOf(command.name).toEqualTypeOf<"ping">();
    expectTypeOf(command.description).toEqualTypeOf<"Ping">();
  });
});
