import {
  createLogger,
  FrameworkError,
  type FrameworkLogger,
  type Plugin,
  ServiceContainer,
  serializeError,
} from "@alenexum/core";

/**
 * Background jobs: fixed-rate scheduled units with timeouts, overlap
 * control, per-run error boundaries, and cooperative cancellation via
 * `AbortSignal`. In-process by design — this is scheduling and lifecycle,
 * not distributed workers (see README non-goals). Wire into a bot with
 * `jobsPlugin(scheduler)`; jobs are low-frequency by contract, never hot
 * path.
 */

export type JobOverlap = "skip" | "run";

export interface JobContext {
  readonly name: string;
  readonly runCount: number;
  readonly logger: FrameworkLogger;
  readonly services: ServiceContainer;
  /** Aborts on per-run timeout or scheduler stop (cooperative). */
  readonly signal: AbortSignal;
}

export interface JobDefinition {
  readonly name: string;
  /** Fixed-rate interval. Without it the job runs only via runOnStart/trigger. */
  readonly everyMs?: number | undefined;
  readonly runOnStart?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
  /** `"skip"` (default) drops a tick while the previous run is active. */
  readonly overlap?: JobOverlap | undefined;
  run(ctx: JobContext): void | Promise<void>;
}

export function defineJob<const T extends JobDefinition>(definition: T): T {
  return definition;
}

export interface JobStats {
  readonly runs: number;
  readonly failures: number;
  readonly skips: number;
  readonly lastDurationMs: number | undefined;
  readonly lastRunAt: number | undefined;
  readonly lastError: string | undefined;
  readonly running: boolean;
}

export interface JobSchedulerOptions {
  readonly logger?: FrameworkLogger | undefined;
  readonly services?: ServiceContainer | undefined;
  /** Upper bound for stop() while runs drain. Throws FRAMEWORK_SHUTDOWN_TIMEOUT. */
  readonly stopTimeoutMs?: number | undefined;
}

interface RegisteredJob {
  readonly definition: JobDefinition;
  timer: ReturnType<typeof setInterval> | undefined;
  readonly inFlight: Set<Promise<void>>;
  readonly controllers: Set<AbortController>;
  runs: number;
  failures: number;
  skips: number;
  lastDurationMs: number | undefined;
  lastRunAt: number | undefined;
  lastError: string | undefined;
}

export class JobScheduler {
  private readonly jobs = new Map<string, RegisteredJob>();
  private readonly logger: FrameworkLogger;
  private readonly services: ServiceContainer;
  private readonly stopTimeoutMs: number;
  private started = false;

  constructor(options: JobSchedulerOptions = {}) {
    this.logger = options.logger ?? createLogger({ level: "info" });
    this.services = options.services ?? new ServiceContainer();
    this.stopTimeoutMs = options.stopTimeoutMs ?? 10_000;
  }

  register(definition: JobDefinition): this {
    assertValidJob(definition, this.jobs.has(definition.name));
    const registered: RegisteredJob = {
      definition,
      timer: undefined,
      inFlight: new Set(),
      controllers: new Set(),
      runs: 0,
      failures: 0,
      skips: 0,
      lastDurationMs: undefined,
      lastRunAt: undefined,
      lastError: undefined,
    };
    this.jobs.set(definition.name, registered);
    if (this.started) {
      this.schedule(registered);
      if (definition.runOnStart === true) {
        void this.execute(registered, "start");
      }
    }
    return this;
  }

  getNames(): string[] {
    return [...this.jobs.keys()];
  }

  getStatus(name: string): JobStats | undefined {
    const job = this.jobs.get(name);
    if (job === undefined) {
      return undefined;
    }
    return {
      runs: job.runs,
      failures: job.failures,
      skips: job.skips,
      lastDurationMs: job.lastDurationMs,
      lastRunAt: job.lastRunAt,
      lastError: job.lastError,
      running: job.inFlight.size > 0,
    };
  }

  /** Manual run through the same overlap/timeout/boundary path. Rethrows after recording. */
  async trigger(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (job === undefined) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Cannot trigger unknown job "${name}"`,
        context: { subsystem: "jobs", event: "job.trigger" },
      });
    }
    await this.execute(job, "trigger");
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.logger.info(
      { subsystem: "jobs", event: "scheduler.started" },
      "Job scheduler started",
    );
    for (const job of this.jobs.values()) {
      this.schedule(job);
      if (job.definition.runOnStart === true) {
        void this.execute(job, "start");
      }
    }
  }

  async stop(): Promise<void> {
    // No early return: manual triggers may be in flight even without start().
    this.started = false;
    for (const job of this.jobs.values()) {
      if (job.timer !== undefined) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
      for (const controller of job.controllers) {
        controller.abort();
      }
    }
    this.logger.info(
      { subsystem: "jobs", event: "scheduler.stopping" },
      "Job scheduler stopping",
    );
    const deadline = Date.now() + this.stopTimeoutMs;
    const pending = [...this.jobs.values()].flatMap((job) => [...job.inFlight]);
    if (pending.length > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw shutdownTimeoutError([...this.jobs.keys()], this.stopTimeoutMs);
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.allSettled(pending),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  shutdownTimeoutError(
                    [...this.jobs.keys()],
                    this.stopTimeoutMs,
                  ),
                ),
              remainingMs,
            );
            timer.unref?.();
          }),
        ]);
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    }
    this.logger.info(
      { subsystem: "jobs", event: "scheduler.stopped" },
      "Job scheduler stopped",
    );
  }

  private schedule(job: RegisteredJob): void {
    const everyMs = job.definition.everyMs;
    if (everyMs === undefined || job.timer !== undefined) {
      return;
    }
    job.timer = setInterval(() => {
      void this.execute(job, "tick").catch(() => {
        // Recorded and logged inside execute; never an unhandled rejection.
      });
    }, everyMs);
    job.timer.unref?.();
  }

  private async execute(
    job: RegisteredJob,
    origin: "tick" | "start" | "trigger",
  ): Promise<void> {
    const definition = job.definition;
    if (job.inFlight.size > 0 && (definition.overlap ?? "skip") === "skip") {
      job.skips += 1;
      this.logger.debug(
        { subsystem: "jobs", event: "job.skipped", command: definition.name },
        `Job "${definition.name}" skipped (${origin}, previous run active)`,
      );
      return;
    }
    const controller = new AbortController();
    job.controllers.add(controller);
    const runCount = job.runs + job.failures + 1;
    const logger = this.logger.child({
      subsystem: "jobs",
      module: definition.name,
    });
    const startedAt = Date.now();
    // `let` (not `const`): the finally below may run before assignment on a
    // synchronous throw; delete(undefined) is a harmless no-op in that case.
    let current!: Promise<void>;
    current = (async () => {
      try {
        if (definition.timeoutMs === undefined) {
          await definition.run({
            name: definition.name,
            runCount,
            logger,
            services: this.services,
            signal: controller.signal,
          });
        } else {
          await this.executeWithTimeout(definition, controller, {
            name: definition.name,
            runCount,
            logger,
            services: this.services,
          });
        }
        job.runs += 1;
        job.lastDurationMs = Date.now() - startedAt;
        job.lastRunAt = Date.now();
      } catch (error) {
        job.failures += 1;
        job.lastDurationMs = Date.now() - startedAt;
        job.lastRunAt = Date.now();
        job.lastError =
          error instanceof Error ? error.message : "Unknown job error";
        logger.error(
          {
            event: "job.failed",
            command: definition.name,
            durationMs: job.lastDurationMs,
            error: serializeError(error),
          },
          `Job "${definition.name}" failed`,
        );
        if (origin === "trigger") {
          throw error;
        }
      } finally {
        job.inFlight.delete(current);
        job.controllers.delete(controller);
      }
    })();
    job.inFlight.add(current);
    await current;
  }

  private async executeWithTimeout(
    definition: JobDefinition,
    controller: AbortController,
    ctx: Omit<JobContext, "signal">,
  ): Promise<void> {
    const timeoutMs = definition.timeoutMs as number;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        definition.run({ ...ctx, signal: controller.signal }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new Error(
                `Job "${definition.name}" timed out after ${timeoutMs}ms`,
              ),
            );
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}

function assertValidJob(definition: JobDefinition, duplicate: boolean): void {
  const fail = (message: string): never => {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message,
      context: { subsystem: "jobs", event: "job.register" },
    });
  };
  if (typeof definition.name !== "string" || definition.name.length === 0) {
    fail("Jobs require a non-empty name");
  }
  if (duplicate) {
    fail(`Duplicate job registration: "${definition.name}"`);
  }
  if (typeof definition.run !== "function") {
    fail(`Job "${definition.name}" requires a run() function`);
  }
  if (
    definition.everyMs !== undefined &&
    (!Number.isFinite(definition.everyMs) || definition.everyMs <= 0)
  ) {
    fail(`Job "${definition.name}" needs a finite positive everyMs`);
  }
  if (
    definition.timeoutMs !== undefined &&
    (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)
  ) {
    fail(`Job "${definition.name}" needs a finite positive timeoutMs`);
  }
  if (
    definition.overlap !== undefined &&
    definition.overlap !== "skip" &&
    definition.overlap !== "run"
  ) {
    fail(
      `Job "${definition.name}" has unknown overlap mode "${definition.overlap}"`,
    );
  }
}

function shutdownTimeoutError(
  pending: string[],
  budgetMs: number,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_SHUTDOWN_TIMEOUT",
    category: "Internal",
    message: `Timed out waiting for job(s) ${pending.join(", ")} after ${budgetMs}ms`,
    context: { subsystem: "jobs", event: "scheduler.stop" },
  });
}

/**
 * Bot lifecycle wiring: scheduler starts once ready, stops before teardown.
 * This exercises the plugin system as designed — cross-cutting lifecycle
 * without touching command code.
 */
export function jobsPlugin(scheduler: JobScheduler, name = "jobs"): Plugin {
  return {
    name,
    setup: (host) => {
      host.on("afterStart", () => scheduler.start());
      host.on("beforeStop", () => scheduler.stop());
    },
  };
}
