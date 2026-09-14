import { describe, expect, expectTypeOf, it } from "vitest";
import {
  Bot,
  createLogger,
  defineCommand,
  integerOption,
  type ResolvedUser,
  stringOption,
  userOption,
} from "../src/index.js";

describe("command option inference", () => {
  it("types required vs optional options", () => {
    const command = defineCommand({
      name: "ban",
      description: "Ban",
      options: {
        target: userOption({ description: "u", required: true }),
        reason: stringOption({ description: "r" }),
      },
      execute(ctx) {
        expectTypeOf(ctx.options.target).toEqualTypeOf<ResolvedUser>();
        expectTypeOf(ctx.options.reason).toEqualTypeOf<string | undefined>();
      },
    });
    expectTypeOf(command.name).toEqualTypeOf<"ban">();
  });

  it("infers choice literal unions", () => {
    defineCommand({
      name: "pick",
      description: "Pick",
      options: {
        color: stringOption({
          description: "s",
          choices: [
            { name: "Red", value: "red" },
            { name: "Blue", value: "blue" },
          ],
        }),
        amount: integerOption({
          description: "i",
          required: true,
          choices: [
            { name: "One", value: 1 },
            { name: "Two", value: 2 },
          ],
        }),
      },
      execute(ctx) {
        expectTypeOf(ctx.options.color).toEqualTypeOf<
          "red" | "blue" | undefined
        >();
        expectTypeOf(ctx.options.amount).toEqualTypeOf<1 | 2>();
      },
    });
  });

  it("gives an empty options object when no schema is defined", () => {
    defineCommand({
      name: "ping",
      description: "Ping",
      execute(ctx) {
        expectTypeOf(ctx.options).toEqualTypeOf<Record<string, never>>();
      },
    });
  });

  it("rejects assigning optional options to non-optional locals", () => {
    defineCommand({
      name: "echo",
      description: "Echo",
      options: { text: stringOption({ description: "s" }) },
      execute(ctx) {
        // @ts-expect-error - optional option is not assignable to string
        const _text: string = ctx.options.text;
        expect(_text).toBeDefined();
      },
    });
  });

  it("stays assignable to the stored command shape", () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    bot.command(
      defineCommand({
        name: "add",
        description: "Add",
        options: {
          a: integerOption({ description: "a", required: true }),
          b: integerOption({ description: "b", required: true }),
        },
        execute: async (ctx) => {
          expectTypeOf(ctx.options.a).toEqualTypeOf<number>();
          await ctx.reply(String(ctx.options.a + ctx.options.b));
        },
      }),
    );
    expect(bot.getCommandNames()).toEqual(["add"]);
  });
});
