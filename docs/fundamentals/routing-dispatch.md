---
title: Routing and dispatch
description: How handleInteraction routes every interaction kind through registries, guards, middleware, and error boundaries.
---

# Routing and dispatch

All Discord traffic enters through one method:

```ts
const result: DispatchResult = await bot.handleInteraction(rawInteraction, client);
```

`handleInteraction` **never throws and never rejects**. It always resolves to `DispatchSuccess` (`{ ok: true, command, durationMs, requestId }`) or `DispatchFailure` (`{ ok: false, command, error, durationMs, requestId }`). The discord.js connector relies on this — its `interactionCreate` listener keeps a backstop log line that is unreachable in practice.

## Flow

```text
Discord
   ↓
Connector (interactionCreate)
   ↓
handleInteraction(raw, client)
   ↓
Probe interaction kind (chat-input / component / modal / autocomplete / context-menu / unknown)
   ↓
Registry lookup — Map.get (exact, or longest ":"-prefix for customIds)
   ↓  miss → ok:true, command:"", FRAMEWORK_ROUTE_NOT_FOUND logged
Guards stage (runGuards, global first, first deny wins)
   ↓  deny → graceful reply (DEFAULT_DENY_MESSAGE or custom), observed as "denied", ok:true
Middleware onion (global + per-definition, compose)
   ↓  double next() → FRAMEWORK_MIDDLEWARE_FAILED
Handler (execute)
   ↓  throw → FRAMEWORK_COMMAND_HANDLER_FAILED, recovery reply attempted, ok:false
Observer + tracer span closed (framework.dispatch)
```

Key semantics:

- **Unknown interactions resolve `ok: true` with `command: ""`.** Not finding a route is logged (`FRAMEWORK_ROUTE_NOT_FOUND`) but is not a dispatch failure — there was nothing to run.
- **Guard denial is control flow, not failure.** Denied dispatches resolve `ok: true` and are observed as `denied`. Autocomplete denial additionally responds with `[]` so Discord does not hang.
- **Handler errors are wrapped, never swallowed.** The original error is preserved as `cause`, serialized context is logged, a safe recovery reply (`Something went wrong…`) is attempted, and the result is `ok: false`. If recovery itself fails, dispatch still resolves — it never rejects.
- Every dispatch mints a `requestId` (`randomUUID()`), propagated into contexts, logs, error context, and observations.

## Registries (bootstrap-built, hot-path cheap)

| Registry | Key | Lookup |
|---|---|---|
| `CommandRegistry` | slash command name | exact `Map.get` |
| `CustomIdRegistry` (components, modals) | `customId` | exact wins, else longest `:`-prefix probe (`vote` serves `vote:yes` with `args: ["yes"]`) |
| `AutocompleteRegistry` | `command\n option` | option-specific wins over command-level fallback |
| `ContextMenuRegistry` | `type:name` (`user:…`, `message:…`) | exact `Map.get` |

Duplicate registration throws `FRAMEWORK_INVALID_CONFIGURATION` at bootstrap — fail fast, never at runtime. Guard arrays are normalized once at registration (`WeakMap` cache), so the hot path does no reflection.

## Hot-path cost model

Per dispatch: one `randomUUID`, one registry `Map.get`, sequential guard checks, one `compose` closure chain, one handler call, one observer call, one tracer span (when configured). No filesystem access, no linear scans, no per-request reflection, no needless serialization. See [Limitations](../architecture/limitations.md) for what this implies at scale.

Related: [Context](./context.md) · [Middleware & guards](./middleware-guards.md) · [Errors](./errors.md).
