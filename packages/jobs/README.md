# `@nexum/jobs`

In-process background jobs: fixed-rate scheduling, per-run timeouts with
cooperative cancellation, overlap control, isolated error boundaries, and
stats. Wire into a bot with `jobsPlugin(scheduler)`.

```ts
import { JobScheduler, defineJob, jobsPlugin } from "@nexum/jobs";

const scheduler = new JobScheduler({ logger, services });
scheduler.register(
  defineJob({
    name: "heartbeat",
    everyMs: 60_000,
    timeoutMs: 5_000,
    run: async (ctx) => {
      ctx.logger.info({ event: "heartbeat" }, "still alive");
      // ctx.signal aborts on timeout or scheduler stop
    },
  }),
);
await bot.plugin(jobsPlugin(scheduler));
```

- `everyMs` — fixed-rate interval. Without it the job runs only via
  `runOnStart` or `scheduler.trigger(name)`.
- `overlap: "skip"` (default) drops a tick while the previous run is active;
  `"run"` allows concurrency.
- Failures are recorded (`failures`, `lastError`) and logged per run — one
  job never affects another. `trigger()` rethrows after recording.
- `stop()` clears timers, aborts signals, and drains in-flight runs within
  `stopTimeoutMs` (default 10s, else `FRAMEWORK_SHUTDOWN_TIMEOUT`).
- `getStatus(name)` / `getNames()` expose runs, failures, skips, durations.

## Non-goals

- No cron expressions (use `everyMs`; wall-clock schedules can `trigger()`
  from node-cron/croner directly).
- No distributed workers or queues (single process; `worker_threads` and
  external brokers remain future opt-ins).
- Jobs are low-frequency by contract — never put hot-path work here.
