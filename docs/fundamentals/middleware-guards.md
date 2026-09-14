---
title: Middleware and guards
description: The middleware onion, allow/deny guards, permission factories, and cooldowns.
---

# Middleware and guards

Middleware and guards answer different questions. Do not mix them:

- **Middleware** (`bot.use`, per-definition `middleware`): *what happens around the handler?* Logging, timing, tracing, mutation of shared flow. Always calls `next()` (once) unless intentionally short-circuiting.
- **Guard** (`bot.guard`, per-definition `guards`): *is this interaction allowed?* Returns allow/deny. Denial is control flow with a user-facing message — never an exception.

Execution order per dispatch: **global guards → per-definition guards → global middleware → per-definition middleware → handler**. (Guards run as a stage before the onion; see [Routing](./routing-dispatch.md).)

## Middleware

```ts
import type { Middleware } from "@nexum/core";

export default (async (ctx, next) => {
  const start = Date.now();
  ctx.logger.debug({ subsystem: "app", event: "interaction.received" }, `Received "${ctx.route}"`);
  await next();
  ctx.logger.debug(
    { subsystem: "app", event: "interaction.done", durationMs: Date.now() - start },
    `Finished "${ctx.route}"`,
  );
}) satisfies Middleware;
```

`compose` builds a closure chain (no reflection, hot-path cheap). Rules:

- Call `next()` exactly once. Calling it twice throws `FRAMEWORK_MIDDLEWARE_FAILED`.
- Sync and async errors propagate to the dispatch error boundary — middleware failure never silently passes.
- Short-circuiting (not calling `next()`) is legal but must be deliberate and logged; the handler simply never runs.

## Guards

```ts
import { defineGuard } from "@nexum/core";

export const audit = defineGuard({
  name: "audit",
  check: (ctx) => {
    ctx.logger.debug({ subsystem: "audit", event: "audit.route" }, `Route ${ctx.route}`);
    return true; // or { allowed: false, message: "Custom denial" }
  },
});
bot.guard(audit);
```

`runGuards` evaluates sequentially; the **first denial wins**. A throwing check is a bug and propagates to the error boundary. A malformed return (neither boolean nor `{ allowed }`) is rejected. Denial replies with the guard's `message` or `DEFAULT_DENY_MESSAGE` (`"You don't have permission to use this."`) and resolves `ok: true`, observed as `denied`.

## Permission factories

`permissions.ts` provides fail-closed guard factories (unreadable shapes deny, never allow):

```ts
import { requireGuild, requireUserPermissions, requireRoles } from "@nexum/core";
import { PermissionFlagsBits } from "discord.js";

bot.command({
  name: "server",
  description: "Server info",
  guards: [requireGuild()],
  async execute(ctx) { /* ctx.guildId is non-null here */ },
});

bot.command({
  name: "ban",
  description: "Ban a member",
  guards: [requireUserPermissions(PermissionFlagsBits.BanMembers)],
  async execute(ctx) { /* ... */ },
});
```

| Factory | Checks | Notes |
|---|---|---|
| `requireGuild()` | `guildId != null` | Denies in DMs |
| `requireUserPermissions(bits)` | `memberPermissions.has(bits)` | `bigint` or array; fail-closed |
| `requireBotPermissions(bits)` | `appPermissions.has(bits)` | Same shape, bot side |
| `requireRoles(ids)` | `member.roles` as `string[]` or discord.js collection | Handles both shapes |
| `requireUserIds(ids)` | `userId` allowlist | Owner-only commands |

All accept `{ message }` to override the denial text.

## Cooldowns

Cooldown is a guard, not middleware:

```ts
import { cooldown } from "@nexum/core";

bot.command({
  name: "echo",
  description: "Echo text",
  guards: [cooldown({ durationMs: 10_000 })], // per-user, per-route
  async execute(ctx) { /* ... */ },
});
```

Options: `scope` (`user` | `channel` | `guild` | `global`, default `user`), `key` (share or isolate buckets; default is the route), `message` (string or `(secondsLeft) => string`), `store` (custom `CooldownStore`), `now` (injectable clock for tests). Missing scope IDs degrade to a `"global"` bucket. Denial message defaults to `Slow down — try again in Ns.` with ceiling-rounded seconds. Non-finite/non-positive `durationMs` throws `FRAMEWORK_INVALID_CONFIGURATION` at construction.

`MemoryCooldownStore` (default) is **in-memory, single-process, lazily expiring with recency eviction** (`maxEntries`, default 10 000). It does not survive restarts and is not shared across processes — for multi-process rate limiting, bring external infrastructure at the boundary (see [Limitations](../architecture/limitations.md)).

Related: [Permissions guide](../guides/permissions.md) · [Cooldowns guide](../guides/cooldowns.md).
