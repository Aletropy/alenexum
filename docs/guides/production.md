---
title: Production
description: Operate a single-process Alenexum bot — secrets, deploy modes, shutdown, observability minimums.
---

# Production

This page covers the supported production shape: **single process** (optionally sharded via [Sharding](./sharding.md)). Multi-process queues, caches, and workers are application/infrastructure choices — see [Enterprise boundaries](../architecture/enterprise-boundaries.md).

## Checklist

1. **Secrets from the environment only.** `DISCORD_TOKEN` via env/secret manager. Never commit `.env`; the sandbox `.env.example` is the template. Tokens never appear in logs (redaction is a safety net, not a plan).
2. **Explicit deploy mode.** `guild` for dev velocity, `global` for releases, `skip` when deployment is managed externally. Deploy after login (`await connector.deployCommands()`).
3. **Graceful shutdown.** `SIGINT`/`SIGTERM → bot.stop() → process.exit(0)` (sandbox pattern). Set `shutdownTimeoutMs` to your p99 dispatch duration plus headroom.
4. **Observability minimum.** Structured JSON logs (`pretty: false` in production), `HealthMonitor` with at least the `discord` check, and `createDispatchMetrics` wired as `observer`. Alert on `dispatch_errors_total` rate and `unhealthy` reports.
5. **Resource bounds.** `MemoryCooldownStore(maxEntries)` sized for your command volume; job `timeoutMs` on every job; `overlap: "skip"` unless concurrency is intended.
6. **Release verification.** `pnpm ci` (lint + typecheck + test + build), docs build with broken-link errors, sandbox smoke run against a dev guild (`/ping`, `/health`, one component, one modal, `/jobs`).

## Runtime shape

```text
process (node >= 22)
├── Bot (ready)
│   ├── registries (Map.get hot path)
│   ├── middleware + guards
│   ├── services (metrics, health, scheduler, domain)
│   └── JobScheduler (unref'd intervals, lifecycle-bound)
├── DiscordConnector (Client + REST)
└── /health + /metrics endpoints (your HTTP server, createMetricsHandler)
```

Log with `pretty: false` (JSON) and ship to your aggregator; keep `requestId` in every query. For capacity: scale vertically first; shard when guild count demands it ([Sharding](./sharding.md)); go multi-process only with external state — the framework holds no distributed state to migrate.

Related: [Health & metrics](./health-metrics.md) · [Troubleshooting](./troubleshooting.md) · [Large applications](../architecture/large-app.md).
