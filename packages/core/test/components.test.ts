import { createFakeInteraction } from "@nexum/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Bot } from "../src/bot.js";
import {
  defineComponent,
  detectComponentType,
  isComponentInteraction,
} from "../src/components.js";
import { createLogger } from "../src/logger.js";
import { CustomIdRegistry } from "../src/registry.js";

function testBot() {
  return new Bot({
    token: "test-token",
    logger: createLogger({ level: "silent" }),
  });
}

function buttonFake(customId: string, extra: Record<string, unknown> = {}) {
  return createFakeInteraction({
    commandName: "unused",
    chatInput: false,
    customId,
    kinds: { button: true },
    ...extra,
  } as never);
}

describe("defineComponent", () => {
  it("returns the definition with literal customId", () => {
    const def = defineComponent({
      customId: "vote",
      type: "button",
      execute: async () => {},
    });
    expectTypeOf(def.customId).toEqualTypeOf<"vote">();
    expect(def.type).toBe("button");
  });
});

describe("detectComponentType", () => {
  it("detects kinds and rejects non-components", () => {
    expect(
      detectComponentType(
        createFakeInteraction({ chatInput: false, kinds: { button: true } }),
      ),
    ).toBe("button");
    expect(
      detectComponentType(
        createFakeInteraction({
          chatInput: false,
          kinds: { stringSelect: true },
        }),
      ),
    ).toBe("stringSelect");
    expect(
      isComponentInteraction(createFakeInteraction({ chatInput: false })),
    ).toBe(false);
    expect(isComponentInteraction(createFakeInteraction())).toBe(false);
  });
});

describe("CustomIdRegistry", () => {
  const opts = {
    kind: "component",
    registerEvent: "component.register",
    registerCall: "bot.component()",
  };

  it("matches exactly and by prefix with args", () => {
    const registry = new CustomIdRegistry<{
      customId: string;
      execute: () => Promise<void>;
    }>();
    const noop = async () => {};
    registry.registerCustomId({ customId: "vote", execute: noop }, opts);
    registry.registerCustomId({ customId: "poll:close", execute: noop }, opts);
    expect(registry.resolve("vote")).toEqual({
      definition: { customId: "vote", execute: noop },
      args: [],
    });
    expect(registry.resolve("vote:yes:u1")).toEqual({
      definition: { customId: "vote", execute: noop },
      args: ["yes", "u1"],
    });
    expect(registry.resolve("poll:close:now")).toEqual({
      definition: { customId: "poll:close", execute: noop },
      args: ["now"],
    });
    expect(registry.resolve("unknown")).toBeUndefined();
  });

  it("prefers exact matches over prefixes", () => {
    const registry = new CustomIdRegistry<{
      customId: string;
      execute: () => Promise<void>;
    }>();
    const noop = async () => {};
    registry.registerCustomId({ customId: "vote", execute: noop }, opts);
    registry.registerCustomId({ customId: "vote:yes", execute: noop }, opts);
    expect(registry.resolve("vote:yes")?.definition.customId).toBe("vote:yes");
    expect(registry.resolve("vote:no")?.definition.customId).toBe("vote");
  });

  it("rejects empty, overlong, and duplicate ids", () => {
    const registry = new CustomIdRegistry<{
      customId: string;
      execute: () => Promise<void>;
    }>();
    const noop = async () => {};
    expect(() =>
      registry.registerCustomId({ customId: "", execute: noop }, opts),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(() =>
      registry.registerCustomId(
        { customId: "x".repeat(101), execute: noop },
        opts,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    registry.registerCustomId({ customId: "vote", execute: noop }, opts);
    expect(() =>
      registry.registerCustomId({ customId: "vote", execute: noop }, opts),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });
});

describe("Bot.handleInteraction components", () => {
  it("routes buttons with args and update()", async () => {
    const bot = testBot();
    const seen: Record<string, unknown> = {};
    bot.component(
      defineComponent({
        customId: "vote",
        type: "button",
        execute: async (ctx) => {
          seen.customId = ctx.customId;
          seen.args = [...ctx.args];
          seen.type = ctx.componentType;
          await ctx.update("counted");
        },
      }),
    );
    const interaction = buttonFake("vote:yes");
    const result = await bot.handleInteraction(interaction);
    expect(result).toMatchObject({ ok: true, command: "vote:yes" });
    expect(seen).toEqual({
      customId: "vote:yes",
      args: ["yes"],
      type: "button",
    });
    expect(interaction.updatedWith).toBe("counted");
  });

  it("passes select values", async () => {
    const bot = testBot();
    let values: readonly string[] = [];
    bot.component(
      defineComponent({
        customId: "color-pick",
        type: "stringSelect",
        execute: async (ctx) => {
          values = ctx.values;
          await ctx.reply(`picked ${ctx.values.join(",")}`);
        },
      }),
    );
    const interaction = createFakeInteraction({
      chatInput: false,
      customId: "color-pick",
      kinds: { stringSelect: true },
      values: ["red", "blue"],
    });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(true);
    expect(values).toEqual(["red", "blue"]);
    expect(interaction.replies).toEqual(["picked red,blue"]);
  });

  it("returns ROUTE_NOT_FOUND for unknown customIds", async () => {
    const bot = testBot();
    const interaction = buttonFake("nope");
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
    expect(interaction.replies).toEqual([
      "Something went wrong while running that command.",
    ]);
  });

  it("enforces the declared component type", async () => {
    const bot = testBot();
    bot.component(
      defineComponent({
        customId: "only-button",
        type: "button",
        execute: async (ctx) => {
          await ctx.reply("hi");
        },
      }),
    );
    const interaction = createFakeInteraction({
      chatInput: false,
      customId: "only-button",
      kinds: { stringSelect: true },
      values: ["x"],
    });
    const result = await bot.handleInteraction(interaction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FRAMEWORK_ROUTE_NOT_FOUND");
    }
  });

  it("fails double-ack across reply and update", async () => {
    const bot = testBot();
    bot.component(
      defineComponent({
        customId: "vote",
        execute: async (ctx) => {
          await ctx.reply("one");
          await ctx.update("two");
        },
      }),
    );
    const result = await bot.handleInteraction(buttonFake("vote"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(
        "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
      );
    }
  });

  it("runs global middleware for components", async () => {
    const bot = testBot();
    const order: string[] = [];
    bot.use(async (_ctx, next) => {
      order.push("global");
      await next();
    });
    bot.component(
      defineComponent({
        customId: "vote",
        middleware: [
          async (_ctx, next) => {
            order.push("component");
            await next();
          },
        ],
        execute: async (ctx) => {
          order.push("handler");
          await ctx.reply("ok");
        },
      }),
    );
    await bot.handleInteraction(buttonFake("vote"));
    expect(order).toEqual(["global", "component", "handler"]);
  });
});
