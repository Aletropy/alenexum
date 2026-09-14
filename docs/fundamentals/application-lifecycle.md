---
title: Application and lifecycle
description: Bot construction, lifecycle states, hooks, connectors, and graceful shutdown.
---

# Application and lifecycle

`Bot` (in `@nexum/core`) is the application root. It owns lifecycle, registries, middleware, dispatch, services, and logging — never the network. Network transport is injected through the `Connector` seam.

## Construction

```ts
import { Bot } from "@nexum/core";

const bot = new Bot({
  token: process.env.DISCORD_TOKEN!,
  shutdownTimeoutMs: 10_000, // default; upper bound for graceful stop
});
```

Options are validated by `resolveConfig` (zod). Invalid input throws `FRAMEWORK_INVALID_CONFIGURATION` with a `likelyCause` diagnostic (commonly an unset `DISCORD_TOKEN`). The token is held for the connector and never logged.

| Option | Required | Default | Purpose |
|---|---|---|---|
| `token` | Yes | — | Non-empty string. Validated, never logged. |
| `connector` | No | — | Transport. Usually attached later via `attachConnector()`. |
| `logger` | No | pino JSON logger | Bring-your-own `FrameworkLogger`. |
| `shutdownTimeoutMs` | No | `10_000` | Positive int. Deadline for `stop()` before `FRAMEWORK_SHUTDOWN_TIMEOUT`. |
| `tracer` | No | off | Structural `TracerLike` (an OTel tracer satisfies it, no SDK dependency). |
| `observer` | No | off | `DispatchObserver` sink for metrics/audit. |

Full reference: [Configuration](../reference/configuration.md).

## Status machine

```text
idle → starting → ready → stopping → stopped
```

- `getStatus()` returns the current state.
- `start()` is idempotent-safe: starting twice is rejected; a failed start is restartable.
- `attachConnector()` while running throws `FRAMEWORK_LIFECYCLE_HOOK_FAILED`.
- `stop()` when never started is a no-op.

## Hooks

```ts
bot.on("beforeStart", async () => { /* connect pools, warm caches */ });
bot.on("afterStart", async () => { /* mark ready, start cron-like work via jobs */ });
bot.on("beforeStop", async () => { /* stop accepting work */ });
bot.on("afterStop", async () => { /* flush logs, close pools */ });
```

Hook failures abort the transition with `FRAMEWORK_LIFECYCLE_HOOK_FAILED` and leave the bot restartable — a failed `beforeStart` never leaves a half-started bot. The jobs integration binds here: `jobsPlugin(scheduler)` starts the scheduler on `afterStart` and stops it on `beforeStop`.

## Connector

```ts
bot.attachConnector(connector); // exactly once, before start
await bot.start();              // runs beforeStart → connector.start() → afterStart
await bot.stop();               // runs beforeStop → connector.stop() → afterStop
```

`Connector` is `{ name, start(), stop() }`. `@nexum/discord`'s connector logs in (`client.login`), routes `interactionCreate → bot.handleInteraction`, and destroys the client on stop. Attaching a second connector throws `FRAMEWORK_INVALID_CONFIGURATION`; a connector start failure surfaces as `FRAMEWORK_CONNECTOR_START_FAILED`.

## Graceful shutdown

`stop()` waits for in-flight dispatches (`getActiveDispatchCount()`) up to `shutdownTimeoutMs`, then either completes or throws `FRAMEWORK_SHUTDOWN_TIMEOUT`. The sandbox wires `SIGINT`/`SIGTERM → bot.stop() → process.exit(0)`.

Related: [Routing & dispatch](./routing-dispatch.md) · [Configuration reference](../reference/configuration.md) · [Production](../guides/production.md).
