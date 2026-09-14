import { Bot, createLogger, FrameworkError } from "@alenexum/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineJob, JobScheduler, jobsPlugin } from "../src/jobs.js";

function silentScheduler(options: Record<string, unknown> = {}) {
  return new JobScheduler({
    logger: createLogger({ level: "silent" }),
    ...options,
  });
}

describe("defineJob", () => {
  it("preserves literal names", () => {
    const job = defineJob({ name: "heartbeat", run: () => {} });
    expectTypeOf(job.name).toEqualTypeOf<"heartbeat">();
  });
});

describe("registration", () => {
  it("validates definitions", () => {
    const scheduler = silentScheduler();
    expect(() => scheduler.register({ name: "", run: () => {} })).toThrowError(
      FrameworkError,
    );
    expect(() =>
      scheduler.register({ name: "a", run: undefined as never }),
    ).toThrowError(FrameworkError);
    expect(() =>
      scheduler.register({ name: "a", run: () => {}, everyMs: 0 }),
    ).toThrowError(FrameworkError);
    expect(() =>
      scheduler.register({ name: "a", run: () => {}, timeoutMs: -1 }),
    ).toThrowError(FrameworkError);
    expect(() =>
      scheduler.register({
        name: "a",
        run: () => {},
        overlap: "queue" as never,
      }),
    ).toThrowError(FrameworkError);
    scheduler.register(defineJob({ name: "a", run: () => {} }));
    expect(() =>
      scheduler.register(defineJob({ name: "a", run: () => {} })),
    ).toThrowError(
      expect.objectContaining({ code: "FRAMEWORK_INVALID_CONFIGURATION" }),
    );
    expect(scheduler.getNames()).toEqual(["a"]);
    expect(scheduler.getStatus("missing")).toBeUndefined();
  });
});

describe("scheduling", () => {
  it("runs on an interval and stops cleanly", async () => {
    const scheduler = silentScheduler();
    let runs = 0;
    scheduler.register(
      defineJob({
        name: "tick",
        everyMs: 10,
        run: () => {
          runs += 1;
        },
      }),
    );
    await scheduler.start();
    await scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect(runs).toBeGreaterThanOrEqual(2);
    const status = scheduler.getStatus("tick");
    expect(status?.runs).toBe(runs);
    expect(status?.failures).toBe(0);
    expect(typeof status?.lastDurationMs).toBe("number");
    await scheduler.stop();
    await scheduler.stop();
    const frozen = runs;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(runs).toBe(frozen);
  });

  it("runs runOnStart jobs without an interval", async () => {
    const scheduler = silentScheduler();
    let runs = 0;
    scheduler.register(
      defineJob({
        name: "once",
        runOnStart: true,
        run: () => {
          runs += 1;
        },
      }),
    );
    await scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runs).toBe(1);
    await scheduler.stop();
  });

  it("registers jobs after start", async () => {
    const scheduler = silentScheduler();
    await scheduler.start();
    let runs = 0;
    scheduler.register(
      defineJob({
        name: "late",
        everyMs: 10,
        run: () => {
          runs += 1;
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(runs).toBeGreaterThanOrEqual(1);
    await scheduler.stop();
  });
});

describe("trigger", () => {
  it("runs manually and rethrows failures after recording", async () => {
    const scheduler = silentScheduler();
    let runs = 0;
    scheduler.register(
      defineJob({
        name: "manual",
        run: () => {
          runs += 1;
        },
      }),
    );
    await scheduler.trigger("manual");
    expect(runs).toBe(1);
    await expect(scheduler.trigger("missing")).rejects.toMatchObject({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
    });
    scheduler.register(
      defineJob({
        name: "bad",
        run: () => {
          throw new Error("job bug");
        },
      }),
    );
    await expect(scheduler.trigger("bad")).rejects.toThrow("job bug");
    expect(scheduler.getStatus("bad")).toMatchObject({
      failures: 1,
      lastError: "job bug",
    });
  });
});

describe("overlap", () => {
  it("skips ticks while a run is active by default", async () => {
    const scheduler = silentScheduler();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    scheduler.register(defineJob({ name: "slow", run: () => gate }));
    const first = scheduler.trigger("slow");
    const second = scheduler.trigger("slow");
    await second;
    expect(scheduler.getStatus("slow")).toMatchObject({ skips: 1, runs: 0 });
    release();
    await first;
    expect(scheduler.getStatus("slow")).toMatchObject({ runs: 1 });
  });

  it("runs concurrently with overlap run", async () => {
    const scheduler = silentScheduler();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let concurrent = 0;
    let peak = 0;
    scheduler.register(
      defineJob({
        name: "parallel",
        overlap: "run",
        run: async () => {
          concurrent += 1;
          peak = Math.max(peak, concurrent);
          await gate;
          concurrent -= 1;
        },
      }),
    );
    const first = scheduler.trigger("parallel");
    const second = scheduler.trigger("parallel");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(peak).toBe(2);
    release();
    await Promise.all([first, second]);
    expect(scheduler.getStatus("parallel")).toMatchObject({
      runs: 2,
      skips: 0,
    });
  });
});

describe("timeout and cancellation", () => {
  it("aborts cooperative jobs and records the timeout", async () => {
    const scheduler = silentScheduler();
    let aborted = false;
    scheduler.register(
      defineJob({
        name: "coop",
        timeoutMs: 20,
        run: async (ctx) => {
          await new Promise<void>((resolve) => {
            if (ctx.signal.aborted) {
              aborted = true;
              resolve();
              return;
            }
            ctx.signal.addEventListener("abort", () => {
              aborted = true;
              resolve();
            });
          });
        },
      }),
    );
    await scheduler.trigger("coop").catch((error: unknown) => {
      expect((error as Error).message).toContain("timed out after 20ms");
    });
    expect(aborted).toBe(true);
    expect(scheduler.getStatus("coop")).toMatchObject({ failures: 1 });
    expect(scheduler.getStatus("coop")?.lastError).toContain(
      "timed out after 20ms",
    );
  });

  it("isolates failures across jobs", async () => {
    const scheduler = silentScheduler();
    let healthy = 0;
    scheduler.register(
      defineJob({
        name: "bad",
        everyMs: 10,
        run: () => {
          throw new Error("always");
        },
      }),
    );
    scheduler.register(
      defineJob({
        name: "good",
        everyMs: 10,
        run: () => {
          healthy += 1;
        },
      }),
    );
    await scheduler.start();
    await new Promise((resolve) => setTimeout(resolve, 45));
    await scheduler.stop();
    expect(healthy).toBeGreaterThanOrEqual(1);
    expect(scheduler.getStatus("bad")?.failures).toBeGreaterThanOrEqual(1);
  });
});

describe("stop", () => {
  it("waits for in-flight runs", async () => {
    const scheduler = silentScheduler();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    scheduler.register(defineJob({ name: "slow", run: () => gate }));
    const run = scheduler.trigger("slow");
    await new Promise((resolve) => setTimeout(resolve, 10));
    let stopped = false;
    const stopping = scheduler.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(false);
    release();
    await run;
    await stopping;
    expect(stopped).toBe(true);
  });

  it("times out abandoning stuck runs", async () => {
    const scheduler = silentScheduler({ stopTimeoutMs: 30 });
    scheduler.register(
      defineJob({ name: "stuck", run: () => new Promise<void>(() => {}) }),
    );
    const run = scheduler.trigger("stuck");
    run.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(scheduler.stop()).rejects.toMatchObject({
      code: "FRAMEWORK_SHUTDOWN_TIMEOUT",
    });
  });
});

describe("jobsPlugin", () => {
  it("starts and stops the scheduler with the bot", async () => {
    const scheduler = new JobScheduler({
      logger: createLogger({ level: "silent" }),
    });
    let runs = 0;
    scheduler.register(
      defineJob({
        name: "beat",
        everyMs: 10,
        run: () => {
          runs += 1;
        },
      }),
    );
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    await bot.plugin(jobsPlugin(scheduler));
    await bot.start();
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(runs).toBeGreaterThanOrEqual(1);
    await bot.stop();
    const frozen = runs;
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(runs).toBe(frozen);
  });
});
