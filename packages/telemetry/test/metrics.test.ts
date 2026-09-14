import {
  Bot,
  createLogger,
  type DispatchObserver,
  FrameworkError,
} from "@alenexum/core";
import { chatInputInteraction } from "@alenexum/testing";
import { describe, expect, it } from "vitest";
import {
  Counter,
  createDispatchMetrics,
  createMetricsHandler,
  DEFAULT_DURATION_BUCKETS,
  Gauge,
  Histogram,
  MetricRegistry,
} from "../src/metrics.js";

function testBot(observer: DispatchObserver) {
  const bot = new Bot({
    token: "t",
    logger: createLogger({ level: "silent" }),
    observer,
  });
  bot.command({
    name: "ping",
    description: "Ping",
    execute: async (ctx) => ctx.reply("P"),
  });
  bot.command({
    name: "boom",
    description: "B",
    execute: async () => {
      throw new Error("bang");
    },
  });
  bot.command({
    name: "gated",
    description: "G",
    guards: [{ name: "closed", check: () => false }],
    execute: async () => {},
  });
  return bot;
}

describe("Counter", () => {
  it("counts per label set and rejects misuse", () => {
    const counter = new Counter("hits", "Hits.", ["route"]);
    counter.inc();
    counter.inc(2, { route: "ping" });
    expect(counter.get()).toBe(1);
    expect(counter.get({ route: "ping" })).toBe(2);
    expect(() => counter.inc(-1)).toThrowError(FrameworkError);
    expect(() => counter.inc(1, { bogus: "x" })).toThrowError(FrameworkError);
  });
});

describe("Gauge", () => {
  it("sets, increments, and decrements", () => {
    const gauge = new Gauge("queue", "Queue.");
    gauge.set(5);
    gauge.inc();
    gauge.dec(2);
    expect(gauge.get()).toBe(4);
  });
});

describe("Histogram", () => {
  it("buckets cumulatively with sum and count", () => {
    const histogram = new Histogram("lat", "Latency.", [1, 10]);
    histogram.observe(0.5);
    histogram.observe(5);
    const [sample] = histogram.snapshot();
    expect(sample?.buckets).toEqual([
      { le: 1, count: 1 },
      { le: 10, count: 2 },
    ]);
    expect(sample?.sum).toBe(5.5);
    expect(sample?.count).toBe(2);
  });
});

describe("MetricRegistry", () => {
  it("validates names and buckets, reuses instances", () => {
    const registry = new MetricRegistry();
    expect(() => registry.counter("bad name", "x")).toThrowError(
      FrameworkError,
    );
    expect(() => registry.histogram("h", "x", [])).toThrowError(FrameworkError);
    expect(() => registry.histogram("h2", "x", [5, 1])).toThrowError(
      FrameworkError,
    );
    const first = registry.counter("ok_total", "OK.");
    expect(registry.counter("ok_total", "ignored")).toBe(first);
    expect(DEFAULT_DURATION_BUCKETS.length).toBeGreaterThan(5);
  });

  it("exposes Prometheus text with escaping", () => {
    const registry = new MetricRegistry();
    registry
      .counter("hits", "Hit\ncount.", ["route"])
      .inc(2, { route: 'a"b\\c' });
    registry.gauge("temp", "Temp.").set(21.5);
    registry.histogram("lat", "Lat.", [1]).observe(0.5, {});
    const body = registry.exposition();
    expect(body).toContain("# HELP hits Hit\\ncount.");
    expect(body).toContain("# TYPE hits counter");
    expect(body).toContain('hits{route="a\\"b\\\\c"} 2');
    expect(body).toContain("# TYPE temp gauge");
    expect(body).toContain("temp 21.5");
    expect(body).toContain('lat_bucket{le="1"} 1');
    expect(body).toContain('lat_bucket{le="+Inf"} 1');
    expect(body).toContain("lat_sum 0.5");
    expect(body).toContain("lat_count 1");
    expect(body.endsWith("\n")).toBe(true);
  });
});

describe("createDispatchMetrics", () => {
  it("records success, error, and deny observations", async () => {
    const registry = new MetricRegistry();
    const metrics = createDispatchMetrics(registry);
    const bot = testBot(metrics.observer);
    await bot.handleInteraction(chatInputInteraction("ping"));
    await bot.handleInteraction(chatInputInteraction("boom"));
    await bot.handleInteraction(chatInputInteraction("gated"));
    expect(
      registry
        .counter("dispatch_total", "")
        .get({ route: "ping", kind: "command", outcome: "success" }),
    ).toBe(1);
    expect(
      registry.counter("dispatch_errors_total", "").get({
        route: "boom",
        kind: "command",
        code: "FRAMEWORK_COMMAND_HANDLER_FAILED",
      }),
    ).toBe(1);
    expect(
      registry
        .counter("dispatch_denied_total", "")
        .get({ route: "gated", kind: "command", guard: "closed" }),
    ).toBe(1);
    const samples = registry
      .histogram("dispatch_duration_seconds", "")
      .snapshot();
    expect(samples).toHaveLength(3);
    expect(samples.reduce((total, sample) => total + sample.count, 0)).toBe(3);
    expect(
      registry.gauge("process_uptime_seconds", "").get(),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("createMetricsHandler", () => {
  it("returns a mountable response", () => {
    const registry = new MetricRegistry();
    registry.counter("hits", "Hits.").inc(3);
    const response = createMetricsHandler(registry)();
    expect(response.contentType).toContain("text/plain");
    expect(response.body).toContain("hits 3");
  });
});
