---
title: Configuration reference
description: Every BotOptions field — type, default, impact, performance and security notes.
---

# Configuration reference

Validated by `resolveConfig` (zod). Violations throw `FRAMEWORK_INVALID_CONFIGURATION` (category `Config`).

## `token: string` (required)

Non-empty string. Held on `bot.config` for the connector. **Security:** never logged, never echoed in errors; logger redacts `token` paths. Load from env/secret manager. **Performance:** none.

```ts
new Bot({ token: process.env.DISCORD_TOKEN! });
```

## `shutdownTimeoutMs: number` (default `10_000`)

Positive integer. Upper bound for graceful `stop()` (hook + connector + dispatch drain). Exceeded → `FRAMEWORK_SHUTDOWN_TIMEOUT`. **Performance:** larger values delay process exit under load; size to p99 dispatch + job cooperation. **Recommended:** default for small bots; measure and raise deliberately for slow handlers.

## `connector: Connector` (optional)

Structural `{ name, start(), stop() }`. Attach via constructor or `attachConnector()` (once, before start). Mis-shaped values fail at construction. See [Lifecycle](../fundamentals/application-lifecycle.md).

## `logger: FrameworkLogger` (optional)

Pino-compatible `{ trace…fatal, child }`. Default: JSON pino logger. `pretty: true` only for local dev (parsing cost + human format). `destination` seam for tests.

## `tracer: TracerLike` (optional)

Structural `{ startSpan(name, opts?) }` — an OTel tracer satisfies it with no SDK dependency. Off when omitted (single `undefined` check per dispatch). Throwing tracers are isolated and never break dispatch. **Performance:** span creation per dispatch only when configured.

## `observer: DispatchObserver` (optional)

Structural `{ observe({ route, kind, outcome, durationMs, requestId, errorCode?, guard? }) }`. Off when omitted. `createDispatchMetrics().observer` is the standard implementation. Throwing observers are isolated.

## Related option surfaces

- `DiscordConnectorOptions { intents, clientOptions?, deploy? }` — [Deploy](../guides/deploy-commands.md).
- `ShardOptionsSchema` — [Sharding](../guides/sharding.md).
- `JobSchedulerOptions`, `CooldownOptions` — [Jobs](../guides/background-jobs.md), [Cooldowns](../guides/cooldowns.md).
