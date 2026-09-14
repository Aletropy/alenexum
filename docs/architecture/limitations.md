---
title: Limitations
description: What the framework does not do — stated plainly so teams can plan.
---

# Limitations

- **Not a discord.js replacement.** Gateway, REST, rate limits, caches, builders, collectors, and sharding primitives belong to discord.js. The framework composes them.
- **No database, cache, queue, or bus.** Persistence and messaging are application/infrastructure choices behind service ports. There is no ORM, migration runner, Redis client, or worker pool in the framework.
- **No distributed runtime.** `MemoryCooldownStore` is single-process; `JobScheduler` is in-process; `ShardCoordinator` coordinates processes but shares no state between them. Multi-process consistency is your infrastructure's job.
- **No CLI.** `@nexum/cli` is a reserved stub (`export {}`). Scaffolding, codegen, and deploy CLIs do not exist yet.
- **No performance guarantees.** The hot path is designed cheap (`Map.get` routing, closure middleware chain, single ack flag) and `pnpm bench` runs informational benchmarks, but no benchmark numbers are committed or promised. Measure your workload.
- **No multi-process collectors or cross-shard interactions.** Collectors via discord.js work within one process (sandbox `/poll`); cross-shard flows need application-level correlation.

Each limitation names its owner: **Discord**, **discord.js**, **Application**, or **Infrastructure**. When a limitation lifts in a future version, it will arrive with docs, migration notes, and tests — per [Versioning](../migration/versioning.md).
