---
title: Cooldowns
description: Rate-limit commands per user, channel, guild, or globally with the cooldown guard.
---

# Cooldowns

```ts
import { cooldown } from "@nexum/core";

bot.command({
  name: "echo",
  description: "Echo text",
  guards: [cooldown({ durationMs: 10_000 })],
  async execute(ctx) {
    await ctx.reply("…");
  },
});
```

First call per bucket runs; calls within `durationMs` are denied with `Slow down — try again in Ns.` (ceiling-rounded). Custom denial: `message: "…"`, or `message: (secondsLeft) => …`.

| Option | Default | Notes |
|---|---|---|
| `durationMs` | required | Finite, positive. Invalid values throw `FRAMEWORK_INVALID_CONFIGURATION` at construction. |
| `scope` | `"user"` | `"user"` \| `"channel"` \| `"guild"` \| `"global"`. Missing scope IDs degrade to a `"global"` bucket. |
| `key` | route | Override to share one bucket across commands or isolate sub-actions. |
| `store` | `MemoryCooldownStore` | Implement `CooldownStore { get, set }` for external backends. |
| `now` | `Date.now` | Injectable clock — use it in tests for deterministic expiry. |

`MemoryCooldownStore(maxEntries = 10_000)` is in-memory, single-process, lazily expiring, with recency eviction. It does not survive restarts and is not shared across processes or shards. Cross-process rate limiting is an **infrastructure responsibility**: implement `CooldownStore` over your external store at the boundary.

Test cooldowns with a fake clock (`now`) and the dispatch harness — no timers needed. See [Testing](./testing.md).
