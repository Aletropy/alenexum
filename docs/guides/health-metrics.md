---
title: Health and metrics
description: HealthMonitor checks and Prometheus-style dispatch metrics with zero required infrastructure.
---

# Health and metrics

`@alenexum/telemetry` is opt-in and dependency-free: no Prometheus server, no OTel SDK, no external services required. It provides primitives; exposition and alerting are application choices.

## Health checks

```ts
import { HealthMonitor, discordClientCheck } from "@alenexum/telemetry";

const health = new HealthMonitor();
health.register("discord", discordClientCheck(connector.client));
health.register("services", () => bot.services.has("greeter") && bot.services.has("metrics"));

const report = await health.check();
// { overall: "healthy" | "degraded" | "unhealthy", uptimeMs, checks: [{ name, status, durationMs, error? }] }
```

- Each check races against its timeout (`status: "timeout"` on expiry); throwing checks report `"fail"`, never propagate.
- Aggregation: any failing **critical** check → `unhealthy`; failing non-critical → `degraded`. Registration with a bad shape throws `FRAMEWORK_INVALID_CONFIGURATION` at setup.
- `discordClientCheck(client)` wraps `client.isReady()` fail-closed.
- The sandbox `/health` command renders `monitor.check()` plus uptime and `bot.getActiveDispatchCount()`.

## Dispatch metrics

```ts
import { createDispatchMetrics, MetricRegistry, createMetricsHandler } from "@alenexum/telemetry";

const metrics = createDispatchMetrics(); // { registry, observer }
const bot = new Bot({ token, observer: metrics.observer });
```

The observer records per dispatch: `dispatch_total`, `dispatch_errors_total`, `dispatch_denied_total` (labeled by route/kind/outcome/error code/guard), `dispatch_duration_seconds` (histogram, `DEFAULT_DURATION_BUCKETS`), plus process gauges. `Counter`/`Gauge`/`Histogram`/`MetricRegistry` are usable standalone; `registry.snapshot()` and `registry.exposition()` emit Prometheus text format, and `createMetricsHandler(registry)` returns a mountable HTTP handler for your server.

Custom observability plugs into the same seams without this package: pass any `{ observe }` as `observer` and any OTel-compatible tracer as `tracer`. Throwing observers/tracers never break dispatch — they are isolated at the boundary.

Related: [Logging](../fundamentals/logging.md) · [Troubleshooting](./troubleshooting.md).
