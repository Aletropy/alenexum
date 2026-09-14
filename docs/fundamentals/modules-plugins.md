---
title: Modules and plugins
description: Feature slices vs cross-cutting extensions, the shared name namespace, and dependency order.
---

# Modules and plugins

Same mechanism, different vocabulary:

- **Module** (`defineModule`): a *feature slice*. Owns commands, services, and domain wiring for one area (e.g. `greetings` registers a `greeter` service plus a `/hello` command).
- **Plugin** (`definePlugin`): a *cross-cutting extension*. Adds middleware, guards, or services used across features (e.g. `audit` installs a global guard that logs every route).

Both are `{ name, version?, dependencies?, setup(host) }`, where `host` (`PluginHost`) exposes `command`, `component`, `modal`, `autocomplete`, `contextMenu`, `use`, `guard`, `on`, `services`, and `logger`.

## Example

```ts
// modules/greetings.ts — feature slice
import { defineModule } from "@alenexum/core";

export default defineModule({
  name: "greetings",
  setup(host) {
    host.services.register("greeter", (name: string) => `Hello, ${name}!`);
    host.command({
      name: "hello",
      description: "Say hello",
      async execute(ctx) {
        const greet = ctx.services.get<(n: string) => string>("greeter");
        await ctx.reply(greet("world"));
      },
    });
  },
});
```

```ts
// plugins/audit.ts — cross-cutting
import { defineGuard, definePlugin } from "@alenexum/core";

export default definePlugin({
  name: "audit",
  setup(host) {
    host.guard(
      defineGuard({
        name: "audit",
        check: (ctx) => {
          host.logger.debug({ subsystem: "audit", event: "audit.route" }, `Route ${ctx.route}`);
          return true;
        },
      }),
    );
  },
});
```

```ts
await bot.plugin(auditPlugin);   // async: setup may be async
await bot.module(greetings);     // same host surface
```

## Shared namespace and ordering

Plugins and modules share **one unit namespace** (`claimUnitName`): two units of either kind with the same name throw `FRAMEWORK_INVALID_CONFIGURATION`. Dependencies are **order-enforced** (`assertUnitDependencies`): a unit listing `dependencies: ["db"]` throws unless `db` was registered first. Setup failures throw `FRAMEWORK_PLUGIN_INITIALIZATION_FAILED` with the unit name in context, and the error boundary around init means one bad unit cannot corrupt the host silently.

The host logger is tagged per unit, so `plugin: "audit"` (or `module`) appears in every setup log line.

Related: [Services & DI](./services-di.md) · [Bulk loading](../guides/bulk-loading.md).
