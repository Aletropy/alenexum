---
title: Background jobs
description: Run periodic work with JobScheduler, bound to the bot lifecycle.
---

# Background jobs

`@alenexum/jobs` runs cooperative periodic work in-process: heartbeats, cache refreshes, reminder sweeps. It is not a distributed queue — for multi-process work, see [Limitations](../architecture/limitations.md).

## Defining a job

```ts
import { defineJob } from "@alenexum/jobs";

export default defineJob({
  name: "heartbeat",
  everyMs: 30_000,
  runOnStart: true,
  timeoutMs: 5_000,
  run: async (ctx) => {
    ctx.logger.info({ subsystem: "jobs", event: "heartbeat" }, "tick");
  },
});
```

`JobContext`: `{ name, runCount, logger, services, signal }` — the same `ServiceContainer` as the bot, plus an `AbortSignal` for cooperative cancellation.

## Running the scheduler

```ts
import { JobScheduler, jobsPlugin, loadJobs } from "@alenexum/jobs";

const scheduler = new JobScheduler({ logger: bot.logger.child({ subsystem: "jobs" }), services: bot.services });
bot.services.register("scheduler", scheduler);

await loadJobs(scheduler, bot.logger, src("jobs")); // bootstrap bulk load, sorted, fail-fast
await bot.plugin(jobsPlugin(scheduler));            // start on afterStart, stop on beforeStop
```

Semantics:

- Fixed-rate `setInterval` (unref'd so jobs never hold the process open alone).
- `overlap: "skip"` (default) skips a tick while the previous run is active and records a skip; `"run"` allows concurrency.
- `timeoutMs` aborts cooperatively via `AbortController` and isolates the failure; errors are recorded per job (`getStatus()` → runs/failures/skips/running) and never crash the scheduler.
- `trigger(name)` runs a job manually and rethrows to the caller while still recording.
- `stop()` waits for in-flight runs up to the scheduler timeout, then abandons — a hanging stop surfaces as `FRAMEWORK_SHUTDOWN_TIMEOUT` at the bot level.

Inspect at runtime: `scheduler.getNames()`, `scheduler.getStatus(name)`. The sandbox `/jobs` command exposes both over Discord.
