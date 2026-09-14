# `@nexum/telemetry`

Opt-in production observability. Zero dependencies, no ports owned, no SDKs
vendored — the framework emits observations and spans through structural
hooks; this package consumes them.

## Metrics

```ts
import { createDispatchMetrics, createMetricsHandler } from "@nexum/telemetry";
import http from "node:http";

const metrics = createDispatchMetrics();
const bot = new Bot({ token, observer: metrics.observer });

http
  .createServer((req, res) => {
    if (req.url === "/metrics") {
      const { contentType, body } = createMetricsHandler(metrics.registry)();
      res.writeHead(200, { "content-type": contentType }).end(body);
    } else {
      res.writeHead(404).end();
    }
  })
  .listen(9090);
```

Recorded per dispatch: `dispatch_total{route,kind,outcome}`,
`dispatch_errors_total{route,kind,code}`,
`dispatch_denied_total{route,kind,guard}`,
`dispatch_duration_seconds{route,kind}` (histogram), plus process gauges
refreshed per observation. Custom counters/gauges/histograms via
`registry.counter/gauge/histogram`; `registry.snapshot()` for JSON,
`registry.exposition()` for Prometheus text 0.0.4.

## Health

```ts
import { HealthMonitor, discordClientCheck } from "@nexum/telemetry";

const health = new HealthMonitor();
health.register("discord", discordClientCheck(connector.client));
health.register("db", () => db.isConnected(), { critical: true });
health.register("cache", () => cache.isWarm(), { critical: false }); // degrade, don't fail

http.createServer(async (req, res) => {
  const report = await health.check();
  res.writeHead(report.status === "healthy" ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(report));
});
```

Checks time out individually (default 2s, configurable per check); throwing
or slow checks report `fail`/`timeout` with messages and latencies.

## Tracing

Pass your OpenTelemetry tracer straight through — no adapter package to
install, no version to align:

```ts
import { trace } from "@opentelemetry/api";
import type { TracerLike } from "@nexum/core";

const bot = new Bot({ token, tracer: trace.getTracer("bot") as unknown as TracerLike });
```

One span per dispatch (`framework.dispatch` with `framework.route/kind/request_id`),
exceptions recorded, error status set, spans always ended. A throwing tracer
never breaks dispatch.

## Non-goals

- No HTTP server owned (mount the handlers in yours).
- No OTel SDK vendored (bring your own `@opentelemetry/*`).
- No distributed stores (the in-memory cooldown store documents its eviction
  policy; Redis-backed stores remain a future opt-in).
- No entity caches (discord.js owns them; no framework-level cache need has
  materialized).
