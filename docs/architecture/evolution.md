---
title: Evolution guide
description: When your architecture should change — signals at each size.
---

# Evolution guide

```text
10 lines → 100 lines → feature modules → services → infrastructure layer → jobs/telemetry → shards → (app-owned distribution)
```

| Stage | You feel | Change to make |
|---|---|---|
| Inline bot | file > ~200 lines, two concerns | split files, keep `bot.command` inline |
| Many files | import-list churn | `load*` bulk loading |
| Shared logic | copy-pasted guards/middleware | global middleware/guards or a plugin |
| Shared state | two commands need one resource | module + `ServiceContainer` entry |
| External I/O | handler imports a driver | `infrastructure/` port + service key |
| Periodic work | `setInterval` in app code | `JobScheduler` + `jobsPlugin` |
| On-call pain | blind incidents | `HealthMonitor` + dispatch metrics + requestId queries |
| Gateway saturation | guild-count pressure | `ShardCoordinator` |
| Multi-process need | memory/throughput ceiling | external state + app-owned topology — framework holds nothing to migrate |

Each step is pulled by a felt signal, never pushed by speculation. Skipping stages (e.g. sharding a 3-command bot) is the most common source of accidental complexity — see [Anti-patterns](./anti-patterns.md).
