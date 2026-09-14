import { describe, expect, it } from "vitest";
import { FrameworkError } from "../src/errors.js";
import { ServiceContainer } from "../src/services.js";

describe("ServiceContainer", () => {
  it("registers and resolves services", () => {
    const services = new ServiceContainer();
    const db = { query: () => "ok" };
    services.register("db", db);
    expect(services.get<typeof db>("db")).toBe(db);
    expect(services.has("db")).toBe(true);
    expect(services.has("missing")).toBe(false);
  });

  it("rejects duplicate registration", () => {
    const services = new ServiceContainer();
    services.register("db", 1);
    expect(() => services.register("db", 2)).toThrowError(FrameworkError);
    try {
      services.register("db", 2);
    } catch (error) {
      expect((error as FrameworkError).code).toBe(
        "FRAMEWORK_SERVICE_ALREADY_REGISTERED",
      );
    }
  });

  it("throws FRAMEWORK_SERVICE_NOT_FOUND with diagnostics on missing key", () => {
    const services = new ServiceContainer();
    try {
      services.get("nope");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FrameworkError);
      const err = error as FrameworkError;
      expect(err.code).toBe("FRAMEWORK_SERVICE_NOT_FOUND");
      expect(err.diagnostic?.suggestedInvestigation.length).toBeGreaterThan(0);
    }
  });
});
