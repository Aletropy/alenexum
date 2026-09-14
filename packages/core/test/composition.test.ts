import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { FrameworkError } from "../src/errors.js";
import { createLogger } from "../src/logger.js";
import { defineModule } from "../src/modules.js";
import { definePlugin } from "../src/plugin.js";
import { createFakeInteraction } from "./helpers.js";

class MemoryStream extends Writable {
  lines: string[] = [];
  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(String(chunk));
    callback();
  }
}

describe("defineModule / definePlugin", () => {
  it("preserve literal names", () => {
    const module = defineModule({ name: "greetings", setup: () => {} });
    expect(module.name).toBe("greetings");
    const plugin = definePlugin({ name: "audit", setup: () => {} });
    expect(plugin.name).toBe("audit");
  });
});

describe("modules", () => {
  it("register commands and services through the host", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    await bot.module(
      defineModule({
        name: "greetings",
        setup: (host) => {
          host.services.register(
            "greeter",
            (name: string) => `Hello, ${name}!`,
          );
          host.command({
            name: "hello",
            description: "Hello",
            execute: async (ctx) => {
              await ctx.reply(
                ctx.services.get<(name: string) => string>("greeter")("world"),
              );
            },
          });
        },
      }),
    );
    const interaction = createFakeInteraction({ commandName: "hello" });
    expect(await bot.handleInteraction(interaction)).toMatchObject({
      ok: true,
    });
    expect(interaction.replies).toEqual(["Hello, world!"]);
    expect(bot.services.has("greeter")).toBe(true);
  });

  it("enforce dependency order and unique names", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    await expect(
      bot.module(
        defineModule({
          name: "child",
          dependencies: ["parent"],
          setup: () => {},
        }),
      ),
    ).rejects.toMatchObject({ code: "FRAMEWORK_INVALID_CONFIGURATION" });

    await bot.module(defineModule({ name: "parent", setup: () => {} }));
    await bot.module(
      defineModule({
        name: "child",
        dependencies: ["parent"],
        setup: () => {},
      }),
    );
    await expect(
      bot.module(defineModule({ name: "child", setup: () => {} })),
    ).rejects.toMatchObject({ code: "FRAMEWORK_INVALID_CONFIGURATION" });
  });

  it("share one namespace with plugins and surface setup failures", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    await bot.plugin(definePlugin({ name: "shared", setup: () => {} }));
    await expect(
      bot.module(defineModule({ name: "shared", setup: () => {} })),
    ).rejects.toMatchObject({ code: "FRAMEWORK_INVALID_CONFIGURATION" });
    await expect(
      bot.module(
        defineModule({
          name: "broken",
          setup: () => {
            throw new Error("module bug");
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED" });
  });
});

describe("plugin host", () => {
  it("exposes the full registration surface with a tagged logger", async () => {
    const dest = new MemoryStream();
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "debug", destination: dest }),
    });
    const seen: string[] = [];
    await bot.plugin(
      definePlugin({
        name: "audit",
        dependencies: [],
        setup: (host) => {
          host.command({
            name: "ping",
            description: "Ping",
            execute: async () => {},
          });
          host.component({ customId: "vote", execute: async () => {} });
          host.modal({ customId: "form", execute: async () => {} });
          host.autocomplete({ command: "search", execute: async () => {} });
          host.contextMenu({
            type: "user",
            name: "Inspect",
            execute: async () => {},
          });
          host.use(async (_ctx, next) => {
            seen.push("middleware");
            await next();
          });
          host.guard(() => {
            seen.push("guard");
            return true;
          });
          host.on("afterStart", () => {
            seen.push("hook");
          });
          host.logger.info({ event: "audit.ready" }, "audit ready");
        },
      }),
    );
    expect(seen).not.toContain("hook");
    const tagged = dest.lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.event === "audit.ready");
    expect(tagged?.plugin).toBe("audit");

    await bot.start();
    expect(seen).toContain("hook");
    const interaction = createFakeInteraction({ commandName: "ping" });
    await bot.handleInteraction(interaction);
    expect(seen).toContain("middleware");
    expect(seen).toContain("guard");
    await bot.stop();
  });

  it("validates plugin dependencies", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    await expect(
      bot.plugin(
        definePlugin({
          name: "child",
          dependencies: ["parent"],
          setup: () => {},
        }),
      ),
    ).rejects.toMatchObject({ code: "FRAMEWORK_INVALID_CONFIGURATION" });
    await bot.plugin(definePlugin({ name: "parent", setup: () => {} }));
    await bot.plugin(
      definePlugin({
        name: "child",
        dependencies: ["parent"],
        setup: () => {},
      }),
    );
  });
});

describe("ServiceContainer extras", () => {
  it("tryGet returns undefined and keys lists registrations", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    expect(bot.services.tryGet("missing")).toBeUndefined();
    bot.services.register("a", 1);
    expect(bot.services.tryGet<number>("a")).toBe(1);
    expect(bot.services.keys()).toEqual(["a"]);
    expect(() => bot.services.register("a", 2)).toThrowError(FrameworkError);
  });
});
