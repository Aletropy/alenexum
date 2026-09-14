---
title: Large applications
description: Feature modules, dependency boundaries, jobs, telemetry, sharding, and CI/CD patterns.
---

# Large applications

```text
Application
├── features/        # modules with owned services, strict boundaries
├── infrastructure/  # db, cache, queues, external APIs (app-owned)
├── jobs/            # scheduler jobs (heartbeat, sweeps, refreshes)
├── observability/   # health registry, metrics, dashboards, alerts
├── sharding/        # ShardCoordinator entry (when guild count demands)
└── CI/CD            # lint → typecheck → test → build → docs build → dev-guild smoke
```

- **Dependency boundaries:** features depend on infrastructure ports (service keys), never on each other directly. Cross-feature needs go through shared services or plugin-installed middleware. The shared plugin/module name namespace + order-enforced `dependencies` make violations fail at boot.
- **Ownership:** one module = one owner. The `plugin`/`module` log tag and per-unit setup errors make ownership visible in logs.
- **Jobs:** all periodic work through `JobScheduler` with `timeoutMs` and explicit `overlap`; `/jobs` + `getStatus()` expose runs/failures/skips for dashboards.
- **Telemetry:** `observer` + `tracer` on every bot; `HealthMonitor` gates deploys (unhealthy = stop rollout); `dispatch_duration_seconds` histograms track p99 per route.
- **Sharding:** introduce `ShardCoordinator` when a single gateway connection saturates — not before. Shards share nothing through the framework; shared state (if any) lives in your infrastructure with explicit consistency choices.
- **CI/CD:** `pnpm ci` + docs checks (export coverage, example typecheck, broken links) + sandbox smoke against a dev guild before promoting to `global` deploy.

What stays out of the framework even here: the database, cache, queue, and orchestrator are still **your** choices at the boundary — the framework coordinates, it does not host.
