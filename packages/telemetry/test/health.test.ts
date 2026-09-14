import { FrameworkError } from "@nexum/core";
import { describe, expect, it } from "vitest";
import { discordClientCheck, HealthMonitor } from "../src/health.js";

describe("HealthMonitor", () => {
  it("reports healthy when all checks pass", async () => {
    const monitor = new HealthMonitor();
    monitor.register("a", () => true);
    monitor.register("b", async () => true);
    const report = await monitor.check();
    expect(report.status).toBe("healthy");
    expect(report.checks).toHaveLength(2);
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
    expect(typeof report.uptimeMs).toBe("number");
    expect(typeof report.timestamp).toBe("string");
  });

  it("marks false, throwing, and slow checks", async () => {
    const monitor = new HealthMonitor(20);
    monitor.register("no", () => false);
    monitor.register("boom", () => {
      throw new Error("down");
    });
    monitor.register("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    });
    const report = await monitor.check();
    expect(report.status).toBe("unhealthy");
    const byName = new Map(report.checks.map((check) => [check.name, check]));
    expect(byName.get("no")).toMatchObject({
      status: "fail",
      message: "check returned false",
    });
    expect(byName.get("boom")?.message).toContain("down");
    expect(byName.get("slow")).toMatchObject({ status: "timeout" });
    expect(byName.get("slow")?.message).toContain("timed out after 20ms");
  });

  it("degrades on non-critical failures", async () => {
    const monitor = new HealthMonitor();
    monitor.register("core", () => true);
    monitor.register("optional", () => false, { critical: false });
    const report = await monitor.check();
    expect(report.status).toBe("degraded");
  });

  it("validates registrations", () => {
    const monitor = new HealthMonitor();
    expect(() => monitor.register("", () => true)).toThrowError(FrameworkError);
    expect(() => monitor.register("x", undefined as never)).toThrowError(
      FrameworkError,
    );
    monitor.register("x", () => true);
    expect(() => monitor.register("x", () => true)).toThrowError(
      FrameworkError,
    );
    expect(() =>
      monitor.register("y", () => true, { timeoutMs: 0 }),
    ).toThrowError(FrameworkError);
  });
});

describe("discordClientCheck", () => {
  it("reflects readiness fail-closed", () => {
    expect(discordClientCheck({ isReady: () => true })()).toBe(true);
    expect(discordClientCheck({ isReady: () => false })()).toBe(false);
    expect(
      discordClientCheck({
        isReady: () => {
          throw new Error("nope");
        },
      })(),
    ).toBe(false);
  });
});
