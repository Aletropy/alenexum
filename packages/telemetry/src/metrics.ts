import { type DispatchObserver, FrameworkError } from "@nexum/core";

/**
 * Minimal metrics: counters, gauges, histograms with labels, a JSON
 * snapshot, and Prometheus text exposition. Zero dependencies, opt-in via
 * `@nexum/telemetry` — small bots pay nothing. Wire to a bot
 * with `dispatchMetricsObserver(registry)` passed as `BotOptions.observer`;
 * serve `createMetricsHandler(registry)()` from your own HTTP server (the
 * framework never owns a port).
 */

export type MetricLabels = Record<string, string>;

const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

function assertValidMetric(
  name: string,
  labelNames: readonly string[],
  buckets?: readonly number[],
): void {
  if (!METRIC_NAME.test(name)) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid metric name "${name}": must match [a-zA-Z_:][a-zA-Z0-9_:]*`,
      context: { subsystem: "metrics", event: "metric.register" },
    });
  }
  for (const label of labelNames) {
    if (!METRIC_NAME.test(label)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Invalid label name "${label}" on metric "${name}"`,
        context: { subsystem: "metrics", event: "metric.register" },
      });
    }
  }
  if (buckets !== undefined) {
    if (
      buckets.length === 0 ||
      buckets.some((b) => typeof b !== "number" || !(b > 0))
    ) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Histogram "${name}" needs a non-empty list of positive buckets`,
        context: { subsystem: "metrics", event: "metric.register" },
      });
    }
    for (let index = 1; index < buckets.length; index++) {
      const prev = buckets[index - 1] as number;
      const next = buckets[index] as number;
      if (next <= prev) {
        throw new FrameworkError({
          code: "FRAMEWORK_INVALID_CONFIGURATION",
          category: "Config",
          message: `Histogram "${name}" buckets must be strictly increasing`,
          context: { subsystem: "metrics", event: "metric.register" },
        });
      }
    }
  }
}

function labelKey(
  labelNames: readonly string[],
  labels: MetricLabels = {},
): string {
  return JSON.stringify(labelNames.map((name) => labels[name] ?? ""));
}

function assertLabels(
  labelNames: readonly string[],
  labels: MetricLabels | undefined,
  metric: string,
): void {
  if (labels === undefined) {
    return;
  }
  for (const key of Object.keys(labels)) {
    if (!labelNames.includes(key)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Metric "${metric}" has no declared label "${key}"`,
        context: { subsystem: "metrics", event: "metric.observe" },
      });
    }
  }
}

export class Counter {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: readonly string[] = [],
  ) {}

  inc(value = 1, labels?: MetricLabels): void {
    if (!(value >= 0)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Counter "${this.name}" cannot increment by negative value ${value}`,
        context: { subsystem: "metrics", event: "metric.observe" },
      });
    }
    assertLabels(this.labelNames, labels, this.name);
    const key = labelKey(this.labelNames, labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(labelKey(this.labelNames, labels)) ?? 0;
  }

  entries(): { labels: MetricLabels; value: number }[] {
    return [...this.values.entries()].map(([key, value]) => ({
      labels: Object.fromEntries(
        this.labelNames.map((name, index) => [
          name,
          (JSON.parse(key) as string[])[index] as string,
        ]),
      ),
      value,
    }));
  }
}

export class Gauge {
  private readonly values = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: readonly string[] = [],
  ) {}

  private at(labels?: MetricLabels): string {
    assertLabels(this.labelNames, labels, this.name);
    return labelKey(this.labelNames, labels);
  }

  set(value: number, labels?: MetricLabels): void {
    this.values.set(this.at(labels), value);
  }

  inc(value = 1, labels?: MetricLabels): void {
    const key = this.at(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  dec(value = 1, labels?: MetricLabels): void {
    this.inc(-value, labels);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(labelKey(this.labelNames, labels)) ?? 0;
  }

  entries(): { labels: MetricLabels; value: number }[] {
    return [...this.values.entries()].map(([key, value]) => ({
      labels: Object.fromEntries(
        this.labelNames.map((name, index) => [
          name,
          (JSON.parse(key) as string[])[index] as string,
        ]),
      ),
      value,
    }));
  }
}

export interface HistogramSnapshot {
  labels: MetricLabels;
  buckets: { le: number; count: number }[];
  sum: number;
  count: number;
}

export class Histogram {
  private readonly counts = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly totals = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: readonly number[],
    readonly labelNames: readonly string[] = [],
  ) {}

  observe(value: number, labels?: MetricLabels): void {
    assertLabels(this.labelNames, labels, this.name);
    const key = labelKey(this.labelNames, labels);
    let counts = this.counts.get(key);
    if (counts === undefined) {
      counts = this.buckets.map(() => 0);
      this.counts.set(key, counts);
    }
    for (const [index, bound] of this.buckets.entries()) {
      if (value <= bound) {
        counts[index] = (counts[index] as number) + 1;
      }
    }
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }

  snapshot(): HistogramSnapshot[] {
    const out: HistogramSnapshot[] = [];
    for (const [key, counts] of this.counts.entries()) {
      const parsed = JSON.parse(key) as string[];
      out.push({
        labels: Object.fromEntries(
          this.labelNames.map((name, index) => [name, parsed[index] as string]),
        ),
        buckets: this.buckets.map((le, index) => ({
          le,
          count: counts[index] as number,
        })),
        sum: this.sums.get(key) ?? 0,
        count: this.totals.get(key) ?? 0,
      });
    }
    return out;
  }
}

export const DEFAULT_DURATION_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export class MetricRegistry {
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  private readonly histograms = new Map<string, Histogram>();

  counter(
    name: string,
    help: string,
    labelNames: readonly string[] = [],
  ): Counter {
    assertValidMetric(name, labelNames);
    const existing = this.counters.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const metric = new Counter(name, help, labelNames);
    this.counters.set(name, metric);
    return metric;
  }

  gauge(name: string, help: string, labelNames: readonly string[] = []): Gauge {
    assertValidMetric(name, labelNames);
    const existing = this.gauges.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const metric = new Gauge(name, help, labelNames);
    this.gauges.set(name, metric);
    return metric;
  }

  histogram(
    name: string,
    help: string,
    buckets: readonly number[] = DEFAULT_DURATION_BUCKETS,
    labelNames: readonly string[] = [],
  ): Histogram {
    assertValidMetric(name, labelNames, buckets);
    const existing = this.histograms.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const metric = new Histogram(name, help, buckets, labelNames);
    this.histograms.set(name, metric);
    return metric;
  }

  snapshot(): {
    counters: {
      name: string;
      help: string;
      samples: { labels: MetricLabels; value: number }[];
    }[];
    gauges: { name: string; help: string }[];
    histograms: { name: string; help: string; samples: HistogramSnapshot[] }[];
  } {
    return {
      counters: [...this.counters.values()].map((metric) => ({
        name: metric.name,
        help: metric.help,
        samples: metric.entries(),
      })),
      gauges: [...this.gauges.values()].map((metric) => ({
        name: metric.name,
        help: metric.help,
      })),
      histograms: [...this.histograms.values()].map((metric) => ({
        name: metric.name,
        help: metric.help,
        samples: metric.snapshot(),
      })),
    };
  }

  /** Prometheus text exposition format 0.0.4. */
  exposition(): string {
    const lines: string[] = [];
    for (const metric of this.counters.values()) {
      lines.push(`# HELP ${metric.name} ${escapeHelp(metric.help)}`);
      lines.push(`# TYPE ${metric.name} counter`);
      for (const sample of metric.entries()) {
        lines.push(
          `${metric.name}${formatLabels(sample.labels)} ${sample.value}`,
        );
      }
    }
    for (const metric of this.gauges.values()) {
      lines.push(`# HELP ${metric.name} ${escapeHelp(metric.help)}`);
      lines.push(`# TYPE ${metric.name} gauge`);
      for (const sample of metric.entries()) {
        lines.push(
          `${metric.name}${formatLabels(sample.labels)} ${sample.value}`,
        );
      }
    }
    for (const metric of this.histograms.values()) {
      lines.push(`# HELP ${metric.name} ${escapeHelp(metric.help)}`);
      lines.push(`# TYPE ${metric.name} histogram`);
      for (const sample of metric.snapshot()) {
        // Counts are stored cumulatively (every bound >= value increments).
        for (const bucket of sample.buckets) {
          lines.push(
            `${metric.name}_bucket${formatLabels({ ...sample.labels, le: String(bucket.le) })} ${bucket.count}`,
          );
        }
        lines.push(
          `${metric.name}_bucket${formatLabels({ ...sample.labels, le: "+Inf" })} ${sample.count}`,
        );
        lines.push(
          `${metric.name}_sum${formatLabels(sample.labels)} ${sample.sum}`,
        );
        lines.push(
          `${metric.name}_count${formatLabels(sample.labels)} ${sample.count}`,
        );
      }
    }
    return `${lines.join("\n")}\n`;
  }
}

function escapeHelp(help: string): string {
  return help.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function formatLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return "";
  }
  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(",")}}`;
}

export interface DispatchMetrics {
  readonly registry: MetricRegistry;
  readonly observer: DispatchObserver;
}

/**
 * Create a registry wired as a `BotOptions.observer`. Records per-route
 * dispatch totals, errors (by code), denies (by guard), duration histograms,
 * and process gauges (refreshed per observation — installed means opted in).
 *
 * ```ts
 * const metrics = createDispatchMetrics();
 * const bot = new Bot({ token, observer: metrics.observer });
 * http.createServer((req, res) => {
 *   const { contentType, body } = createMetricsHandler(metrics.registry)();
 *   res.writeHead(200, { "content-type": contentType }).end(body);
 * });
 * ```
 */
export function createDispatchMetrics(
  registry = new MetricRegistry(),
): DispatchMetrics {
  const total = registry.counter(
    "dispatch_total",
    "Dispatches by route, kind, and outcome.",
    ["route", "kind", "outcome"],
  );
  const errors = registry.counter(
    "dispatch_errors_total",
    "Failed dispatches by route, kind, and code.",
    ["route", "kind", "code"],
  );
  const denied = registry.counter(
    "dispatch_denied_total",
    "Denied dispatches by route, kind, and guard.",
    ["route", "kind", "guard"],
  );
  const duration = registry.histogram(
    "dispatch_duration_seconds",
    "Dispatch duration in seconds by route and kind.",
    DEFAULT_DURATION_BUCKETS,
    ["route", "kind"],
  );
  const rss = registry.gauge(
    "process_resident_memory_bytes",
    "Process resident memory in bytes.",
  );
  const heap = registry.gauge(
    "process_heap_used_bytes",
    "Process heap used in bytes.",
  );
  const uptime = registry.gauge(
    "process_uptime_seconds",
    "Process uptime in seconds.",
  );

  const observer: DispatchObserver = {
    observe(observation) {
      const route = observation.route;
      const kind = observation.kind;
      total.inc(1, { route, kind, outcome: observation.outcome });
      duration.observe(observation.durationMs / 1000, { route, kind });
      if (observation.outcome === "error") {
        errors.inc(1, {
          route,
          kind,
          code: observation.errorCode ?? "unknown",
        });
      }
      if (observation.outcome === "denied") {
        denied.inc(1, { route, kind, guard: observation.guard ?? "unknown" });
      }
      const memory = process.memoryUsage();
      rss.set(memory.rss);
      heap.set(memory.heapUsed);
      uptime.set(process.uptime());
    },
  };
  return { registry, observer };
}

/** Framework-agnostic metrics response; mount it in any HTTP server. */
export function createMetricsHandler(registry: MetricRegistry): () => {
  contentType: string;
  body: string;
} {
  return () => ({
    contentType: "text/plain; version=0.0.4; charset=utf-8",
    body: registry.exposition(),
  });
}
