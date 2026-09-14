import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import { FrameworkError } from "../src/errors.js";

describe("resolveConfig", () => {
  it("accepts a minimal valid config with defaults", () => {
    const config = resolveConfig({ token: "tok" });
    expect(config.token).toBe("tok");
    expect(config.shutdownTimeoutMs).toBe(10_000);
    expect(config.connector).toBeUndefined();
  });

  it("rejects missing token with FRAMEWORK_INVALID_CONFIGURATION", () => {
    let caught: unknown;
    try {
      resolveConfig({});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(FrameworkError);
    const err = caught as FrameworkError;
    expect(err.code).toBe("FRAMEWORK_INVALID_CONFIGURATION");
    expect(err.category).toBe("Config");
  });

  it("rejects non-positive shutdown timeouts", () => {
    expect(() =>
      resolveConfig({ token: "t", shutdownTimeoutMs: -5 }),
    ).toThrowError(FrameworkError);
  });

  it("never echoes the token in validation errors", () => {
    const token = "tok-should-never-appear-in-logs-12345";
    let message = "";
    try {
      // Empty logger object fails LoggerSchema; token must still not leak.
      resolveConfig({ token, logger: {} });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(token);
  });
});
