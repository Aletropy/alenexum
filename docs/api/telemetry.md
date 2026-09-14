---
title: "API: @nexum/telemetry"
description: Health checks and metrics primitives reference.
---

# API: `@nexum/telemetry`

Opt-in, dependency-free (peer: `@nexum/core`). Import from `@nexum/telemetry`.

**Health** (`health.ts`): `HealthCheckStatus = "pass" | "fail" | "timeout"`, `OverallHealth = "healthy" | "degraded" | "unhealthy"`, `HealthCheckResult/Report/Options`, `HealthCheckFn`, `HealthMonitor { register(name, check, options?), getUptimeMs(), check(), runOne() }` (timeout race, critical→unhealthy/degraded aggregation), `discordClientCheck(client: { isReady() })`.

**Metrics** (`metrics.ts`): `MetricLabels`, `Counter { inc/get/entries }`, `Gauge { set/inc/dec/get/entries }`, `Histogram { observe/snapshot }`, `HistogramSnapshot`, `DEFAULT_DURATION_BUCKETS`, `MetricRegistry { counter/gauge/histogram/snapshot/exposition }` (name/bucket validation, Prometheus escaping), `DispatchMetrics { registry, observer }`, `createDispatchMetrics(registry?)` (wires `DispatchObserver`: `dispatch_total`, `dispatch_errors_total`, `dispatch_denied_total`, `dispatch_duration_seconds` + process gauges), `createMetricsHandler(registry)` (mountable HTTP handler).

Guide: [Health & metrics](../guides/health-metrics.md).

## Export index

`HealthMonitor`, `HealthCheckFn`, `HealthCheckOptions`, `HealthCheckResult`, `HealthCheckStatus`, `HealthReport`, `OverallHealth`, `discordClientCheck`, `Counter`, `Gauge`, `Histogram`, `HistogramSnapshot`, `MetricLabels`, `MetricRegistry`, `DispatchMetrics`, `DEFAULT_DURATION_BUCKETS`, `createDispatchMetrics`, `createMetricsHandler`.
