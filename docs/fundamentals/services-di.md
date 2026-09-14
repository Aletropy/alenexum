---
title: Services and dependency injection
description: ServiceContainer — a minimal, explicit, Map-backed service registry.
---

# Services and dependency injection

`ServiceContainer` is deliberately minimal: a `Map<ServiceKey, unknown>` with explicit registration and lookup. No decorators, no reflection, no auto-wiring, no scopes. Lookup is a `Map.get` — hot-path safe.

```ts
bot.services.register("greeter", (name: string) => `Hello, ${name}!`);

// in a handler, module, or job:
const greeter = ctx.services.get<(name: string) => string>("greeter");
```

API: `register(key, value)`, `get<T>(key)` (throws `FRAMEWORK_SERVICE_NOT_FOUND` when missing), `tryGet<T>(key)` (returns `undefined`), `has(key)`, `keys()`. Double registration throws `FRAMEWORK_SERVICE_ALREADY_REGISTERED`. Keys are `string | symbol` — use symbols for collision-proof internal services, strings for documented integration points (`"metrics"`, `"health"`, `"scheduler"` in the sandbox).

## Patterns

- **Module-owned services.** A module registers its services in `setup()` and its commands consume them via `ctx.services.get`. Handlers depend on the service key, not on Discord shapes — this is the seam that keeps domain logic testable (see [Enterprise boundaries](../architecture/enterprise-boundaries.md)).
- **Shared infrastructure.** The sandbox registers `metrics`, `health`, `bot`, and `scheduler` on `bot.services` before loading anything, so commands (`/stats`, `/health`, `/jobs`), jobs (heartbeat logger + services), and health checks all resolve the same instances.
- **Jobs receive services** through `JobScheduler({ services })` and `JobContext.services` — the same container, no second DI system.

Over-injecting is an anti-pattern: if a value is a plain constant or a pure function with no lifecycle, import it directly. Reserve the container for shared stateful resources and seam boundaries.

Related: [Modules & plugins](./modules-plugins.md) · [Background jobs](../guides/background-jobs.md).
