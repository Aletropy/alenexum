import { chatInputInteraction } from "@alenexum/testing";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import {
  type DispatchObservation,
  SPAN_ERROR,
  type SpanLike,
  type TracerLike,
} from "../src/instrumentation.js";
import { createLogger } from "../src/logger.js";

class RecordingTracer implements TracerLike {
  readonly spans: {
    name: string;
    attributes: Record<string, string | number | boolean>;
    status: { code: number; message?: string } | undefined;
    exceptions: unknown[];
    ended: boolean;
  }[] = [];

  startSpan(
    name: string,
    options?: { attributes?: Record<string, string | number | boolean> },
  ): SpanLike {
    const record = {
      name,
      attributes: { ...(options?.attributes ?? {}) },
      status: undefined as { code: number; message?: string } | undefined,
      exceptions: [] as unknown[],
      ended: false,
    };
    this.spans.push(record);
    return {
      setAttribute: (key, value) => {
        record.attributes[key] = value;
      },
      setStatus: (status) => {
        record.status = status;
      },
      recordException: (error) => {
        record.exceptions.push(error);
      },
      end: () => {
        record.ended = true;
      },
    };
  }
}

function observedBot() {
  const observations: DispatchObservation[] = [];
  const tracer = new RecordingTracer();
  const bot = new Bot({
    token: "t",
    logger: createLogger({ level: "silent" }),
    tracer,
    observer: { observe: (observation) => observations.push(observation) },
  });
  return { bot, observations, tracer };
}

describe("dispatch observer", () => {
  it("reports success with route, kind, and duration", async () => {
    const { bot, observations } = observedBot();
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => ctx.reply("P"),
    });
    const result = await bot.handleInteraction(chatInputInteraction("ping"));
    expect(result.ok).toBe(true);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      route: "ping",
      kind: "command",
      outcome: "success",
    });
    expect(typeof observations[0]?.durationMs).toBe("number");
    expect(typeof observations[0]?.requestId).toBe("string");
  });

  it("reports denies with the guard name and errors with the code", async () => {
    const { bot, observations } = observedBot();
    bot.command({
      name: "gated",
      description: "G",
      guards: [
        {
          name: "closed",
          check: () => ({ allowed: false as const, message: "no" }),
        },
      ],
      execute: async () => {},
    });
    bot.command({
      name: "boom",
      description: "B",
      execute: async () => {
        throw new Error("bang");
      },
    });
    await bot.handleInteraction(chatInputInteraction("gated"));
    await bot.handleInteraction(chatInputInteraction("boom"));
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      route: "gated",
      outcome: "denied",
      guard: "closed",
    });
    expect(observations[1]).toMatchObject({
      route: "boom",
      outcome: "error",
      errorCode: "FRAMEWORK_COMMAND_HANDLER_FAILED",
    });
  });

  it("survives a throwing observer", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
      observer: {
        observe: () => {
          throw new Error("metrics down");
        },
      },
    });
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => ctx.reply("P"),
    });
    const result = await bot.handleInteraction(chatInputInteraction("ping"));
    expect(result.ok).toBe(true);
  });
});

describe("dispatch tracer", () => {
  it("wraps success with attributes and ends the span", async () => {
    const { bot, tracer } = observedBot();
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => ctx.reply("P"),
    });
    await bot.handleInteraction(chatInputInteraction("ping"));
    expect(tracer.spans).toHaveLength(1);
    const span = tracer.spans[0] as (typeof tracer.spans)[number];
    expect(span.name).toBe("framework.dispatch");
    expect(span.attributes["framework.route"]).toBe("ping");
    expect(span.attributes["framework.kind"]).toBe("command");
    expect(typeof span.attributes["framework.request_id"]).toBe("string");
    expect(span.status).toBeUndefined();
    expect(span.ended).toBe(true);
  });

  it("records exceptions and error status on failure", async () => {
    const { bot, tracer } = observedBot();
    bot.command({
      name: "boom",
      description: "B",
      execute: async () => {
        throw new Error("bang");
      },
    });
    await bot.handleInteraction(chatInputInteraction("boom"));
    const span = tracer.spans[0] as (typeof tracer.spans)[number];
    expect(span.exceptions).toHaveLength(1);
    expect(span.status).toMatchObject({ code: SPAN_ERROR });
    expect(span.ended).toBe(true);
  });

  it("survives a throwing tracer", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
      tracer: {
        startSpan: () => {
          throw new Error("tracer down");
        },
      },
    });
    bot.command({
      name: "ping",
      description: "Ping",
      execute: async (ctx) => ctx.reply("P"),
    });
    const result = await bot.handleInteraction(chatInputInteraction("ping"));
    expect(result.ok).toBe(true);
  });

  it("validates tracer and observer shapes at bootstrap", () => {
    expect(
      () =>
        new Bot({
          token: "t",
          tracer: {} as never,
          logger: createLogger({ level: "silent" }),
        }),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(
      () =>
        new Bot({
          token: "t",
          observer: {} as never,
          logger: createLogger({ level: "silent" }),
        }),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
  });
});

describe("shutdown drain", () => {
  it("waits for in-flight dispatches before stopping", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
      shutdownTimeoutMs: 5000,
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    bot.command({
      name: "slow",
      description: "S",
      execute: async (ctx) => {
        await gate;
        await ctx.reply("done");
      },
    });
    await bot.start();
    const dispatch = bot.handleInteraction(chatInputInteraction("slow"));
    // Let the dispatch start.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bot.getActiveDispatchCount()).toBe(1);
    const stopping = bot.stop();
    // Still draining: not stopped yet.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(bot.getStatus()).toBe("stopping");
    release();
    await dispatch;
    await stopping;
    expect(bot.getStatus()).toBe("stopped");
    expect(bot.getActiveDispatchCount()).toBe(0);
  });

  it("times out a drain that never finishes", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
      shutdownTimeoutMs: 30,
    });
    bot.command({
      name: "stuck",
      description: "S",
      execute: async () => {
        await new Promise<void>(() => {});
      },
    });
    await bot.start();
    const dispatch = bot.handleInteraction(chatInputInteraction("stuck"));
    // Detached: the stuck handler never settles by design.
    dispatch.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(bot.stop()).rejects.toMatchObject({
      code: "FRAMEWORK_SHUTDOWN_TIMEOUT",
    });
    expect(bot.getStatus()).toBe("stopped");
  });

  it("tracks zero active dispatches at rest", () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    expect(bot.getActiveDispatchCount()).toBe(0);
  });
});
