/**
 * `@nexum/telemetry` — opt-in production observability.
 *
 * Metrics, health checks, and tracing conventions. Zero dependencies, no
 * ports owned, no SDKs vendored: the framework emits observations and spans
 * through structural hooks (`BotOptions.observer/tracer`); this package
 * consumes them. Small bots pay nothing by not installing this package.
 *
 * Tracing note: a real OpenTelemetry tracer satisfies core's `TracerLike`
 * structurally — pass `trace.getTracer("bot")` (one cast) as
 * `BotOptions.tracer`. The framework owns span lifecycle (one span per
 * dispatch, error recording); your SDK owns sampling and export.
 */

export {
  discordClientCheck,
  type HealthCheckFn,
  type HealthCheckOptions,
  type HealthCheckResult,
  type HealthCheckStatus,
  HealthMonitor,
  type HealthReport,
  type OverallHealth,
} from "./health.js";
export {
  Counter,
  createDispatchMetrics,
  createMetricsHandler,
  DEFAULT_DURATION_BUCKETS,
  type DispatchMetrics,
  Gauge,
  Histogram,
  type HistogramSnapshot,
  type MetricLabels,
  MetricRegistry,
} from "./metrics.js";
