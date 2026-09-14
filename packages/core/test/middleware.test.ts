import { describe, expect, it, vi } from "vitest";
import { createCommandContext } from "../src/context.js";
import { createLogger } from "../src/logger.js";
import { compose } from "../src/middleware.js";
import { ServiceContainer } from "../src/services.js";
import { createFakeInteraction } from "./helpers.js";

function makeCtx() {
  return createCommandContext({
    interaction: createFakeInteraction(),
    logger: createLogger({ level: "silent" }),
    services: new ServiceContainer(),
    requestId: "test",
  });
}

describe("compose", () => {
  it("runs middleware onion-style around the handler", async () => {
    const order: string[] = [];
    const chain = compose([
      async (_ctx, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      },
      async (_ctx, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      },
    ]);
    await chain(makeCtx(), () => {
      order.push("handler");
    });
    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "handler",
      "mw2-after",
      "mw1-after",
    ]);
  });

  it("runs the handler with no middleware", async () => {
    const handler = vi.fn();
    await compose([])(makeCtx(), handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects double next() with FRAMEWORK_MIDDLEWARE_FAILED", async () => {
    const chain = compose([
      async (_ctx, next) => {
        await next();
        await next();
      },
    ]);
    await expect(chain(makeCtx(), () => {})).rejects.toMatchObject({
      name: "FrameworkError",
      code: "FRAMEWORK_MIDDLEWARE_FAILED",
    });
  });

  it("propagates sync and async middleware errors", async () => {
    await expect(
      compose([
        () => {
          throw new Error("sync boom");
        },
      ])(makeCtx(), () => {}),
    ).rejects.toThrow("sync boom");
    await expect(
      compose([
        async () => {
          throw new Error("async boom");
        },
      ])(makeCtx(), () => {}),
    ).rejects.toThrow("async boom");
  });

  it("skips downstream middleware when next() is not called", async () => {
    const handler = vi.fn();
    await compose([async () => {}])(makeCtx(), handler);
    expect(handler).not.toHaveBeenCalled();
  });
});
