/**
 * `@nexum/jobs` — in-process background jobs with lifecycle.
 *
 * Fixed-rate scheduling, per-run timeouts with cooperative cancellation,
 * overlap control, isolated error boundaries, and stats. This is scheduling
 * plus lifecycle, not distributed workers (see README non-goals).
 */

export {
  defineJob,
  type JobContext,
  type JobDefinition,
  type JobOverlap,
  JobScheduler,
  type JobSchedulerOptions,
  type JobStats,
  jobsPlugin,
} from "./jobs.js";
export { loadJobs } from "./loader.js";
