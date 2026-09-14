---
title: Enterprise boundaries
description: Responsibility boundaries, ownership, failure domains, and operating patterns — without inventing framework support.
---

# Enterprise boundaries

This page states **who owns what**. The framework's responsibilities are fixed; everything else is explicitly assigned so teams can plan without fiction.

## Responsibility matrix

| Concern | Owner | Framework role |
|---|---|---|
| Gateway, REST, rate limits, caches, collectors, sharding primitives | **Discord / discord.js** | None — composed via adapter |
| Lifecycle, routing, middleware, guards, registries, config, logging, diagnostics, fakes | **Framework** | Implements |
| Domain logic, service implementations, job bodies | **Application** | Hosts (modules/services/jobs) |
| Databases, caches, queues, buses, secrets, orchestrators, dashboards | **Infrastructure** | None — integrates at seams (`ServiceContainer`, `CooldownStore`, `observer`, `tracer`, health checks) |
| Shard topology, process layout, deploy strategy, incident response | **Team** | `ShardCoordinator` assists; strategy is yours |

## Patterns (team-owned, framework-assisted)

- **Boundaries:** domain services accept plain data, return plain data. Handlers translate at the edge. Nothing outside `infrastructure/` imports a driver or discord.js type.
- **Ownership:** one module per domain per owner; shared units registered once in the common namespace; `dependencies` order enforced at boot.
- **Failure domains:** a throwing handler fails one dispatch (`ok: false`, recovery reply); a failing job is recorded, never crashes the scheduler; a failing shard is wrapped with shard context. Blast radius never crosses these lines by default.
- **Backpressure & retries:** Discord ack deadlines (~3 s) are the hard backpressure signal — defer first, then work. Retries against Discord respect discord.js rate limits (not framework code); retries against your infrastructure use your queue/policy.
- **Idempotency & concurrency:** interaction retries can double-deliver; make mutating handlers idempotent at the application layer. Job overlap defaults to `skip`; choose `run` only with concurrency-safe bodies.
- **Graceful shutdown:** `shutdownTimeoutMs` budgets drain; jobs honor `AbortSignal`; deploys gate on health. Capacity plan from `dispatch_duration_seconds` p99 + `getActiveDispatchCount()` peaks.
- **Observability:** `requestId` threads Discord → framework → service → DB/queue logs. Trace sampling, retention, and alerting are infrastructure choices fed by framework seams.
- **Testing:** pyramid from [Testing](../guides/testing.md) plus contract tests on service ports, chaos via sandbox failure commands in staging, and deploy-gated smoke runs.
- **Governance:** narrow public API (additive-only intent), ADRs for boundary decisions, [Versioning](../migration/versioning.md) for upgrade planning.
