---
title: Growing applications
description: Modules, services, middleware, and a database at the boundary — and when each pays off.
---

# Growing applications

```text
src/
├── modules/        # feature slices (commands + services per domain)
├── plugins/        # cross-cutting (audit, global guards)
├── middleware/     # request logging, timing
├── services/       # explicit construction helpers (optional)
├── infrastructure/ # db client, external APIs — Discord-decoupled
└── app.ts          # Bot + services + load* + connector + start
```

Adopt each piece when its signal appears:

| Addition | Signal | Pays off as |
|---|---|---|
| `load*` bulk loading | > ~10 definition files | sorted, fail-fast registration without import lists |
| Modules | commands sharing a service (e.g. `greeter`) | one directory per domain, own services + commands |
| Plugins | same guard/middleware on many commands | one global install instead of N copies |
| `ServiceContainer` | shared stateful resource (db pool, api client) | single construction, `get` at use sites |
| `infrastructure/` | handler importing a DB driver directly | domain logic depends on ports (service keys), drivers live at the edge |
| `createDispatchMetrics` + `HealthMonitor` | first on-call page | error-rate alerts, readiness signal |

Keep the **Discord boundary**: handlers translate (`ctx.options`, `ctx.values`, `ctx.fields`) into domain calls and render domain results back. Domain services take plain data and return plain data — they never import discord.js. This is what makes the [enterprise seam](./enterprise-boundaries.md) possible later without rewrites.

Testing grows with structure: dispatch tests per command, guard tests per policy, module tests for service wiring, and the sandbox for end-to-end wiring.
