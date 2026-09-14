---
title: "API: @alenexum/jobs"
description: Background job scheduler, lifecycle plugin, and bulk loader reference.
---

# API: `@alenexum/jobs`

Depends on `@alenexum/core`. Import from `@alenexum/jobs`.

| Export | Kind | Notes |
|---|---|---|
| `defineJob(def)` | function | Identity; preserves literal `name`. `JobDefinition { name, everyMs?, runOnStart?, timeoutMs?, overlap?, run(ctx) }`. |
| `JobContext` | interface | `{ name, runCount, logger, services, signal }`. |
| `JobOverlap` | type | `"skip"` (default) \| `"run"`. |
| `JobScheduler` | class | `register`, `getNames`, `getStatus`, `trigger` (rethrows, records), `start/stop/schedule`, `execute/executeWithTimeout`. Fixed-rate unref'd intervals; overlap-skip; timeout + `AbortController`; error isolation. |
| `JobSchedulerOptions` / `JobStats` | interfaces | Logger + services; runs/failures/skips/running per job. |
| `jobsPlugin(scheduler, name?)` | function | Returns `Plugin`: `afterStart → start`, `beforeStop → stop`. |
| `loadJobs(scheduler, logger, dir, options?)` | function | Bootstrap bulk load via core `loadDefinitions { kind: "job" }`. |

**Errors:** scheduler stop pressure surfaces as `FRAMEWORK_SHUTDOWN_TIMEOUT` at the bot level. **Limits:** in-process only — no distributed queue (see [Limitations](../architecture/limitations.md)).

Guide: [Background jobs](../guides/background-jobs.md).

## Export index

`defineJob`, `JobDefinition`, `JobContext`, `JobOverlap`, `JobScheduler`, `JobSchedulerOptions`, `JobStats`, `jobsPlugin`, `loadJobs`.
