import { fileURLToPath } from "node:url";
import { createLogger } from "@alenexum/core";
import { describe, expect, it } from "vitest";
import { JobScheduler } from "../src/jobs.js";
import { loadJobs } from "../src/loader.js";

function fixtures(sub: string): string {
  return fileURLToPath(new URL(`./fixtures/${sub}`, import.meta.url));
}

describe("loadJobs", () => {
  it("registers every job default-exported from a directory", async () => {
    const scheduler = new JobScheduler({
      logger: createLogger({ level: "silent" }),
    });
    const report = await loadJobs(
      scheduler,
      createLogger({ level: "silent" }),
      fixtures("jobs"),
    );
    expect(report.loaded).toMatchObject([{ kind: "job", key: "heartbeat" }]);
    expect(scheduler.getNames()).toEqual(["heartbeat"]);
  });

  it("rejects invalid jobs with file context", async () => {
    const scheduler = new JobScheduler({
      logger: createLogger({ level: "silent" }),
    });
    await expect(
      loadJobs(
        scheduler,
        createLogger({ level: "silent" }),
        fixtures("jobs-bad"),
      ),
    ).rejects.toThrow(/broken\.ts/);
    expect(scheduler.getNames()).toEqual([]);
  });
});
