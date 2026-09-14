import { describe, expect, it } from "vitest";
import { FrameworkError } from "../src/errors.js";
import { CommandRegistry } from "../src/registry.js";

const noop = () => {};

describe("CommandRegistry", () => {
  it("registers and retrieves via Map lookup", () => {
    const registry = new CommandRegistry();
    registry.register({ name: "ping", description: "Ping", execute: noop });
    expect(registry.get("ping")?.description).toBe("Ping");
    expect(registry.has("ping")).toBe(true);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.size).toBe(1);
    expect(registry.names()).toEqual(["ping"]);
  });

  it("rejects duplicate names", () => {
    const registry = new CommandRegistry();
    registry.register({ name: "ping", description: "Ping", execute: noop });
    let caught: unknown;
    try {
      registry.register({
        name: "ping",
        description: "Ping again",
        execute: noop,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(FrameworkError);
    expect((caught as FrameworkError).code).toBe(
      "FRAMEWORK_INVALID_CONFIGURATION",
    );
  });

  it.each(["Ping", "has space", "", "a".repeat(33), "bang!"])(
    "rejects invalid name %j",
    (name) => {
      const registry = new CommandRegistry();
      expect(() =>
        registry.register({ name, description: "d", execute: noop }),
      ).toThrowError(FrameworkError);
    },
  );

  it("rejects missing execute and empty description", () => {
    const registry = new CommandRegistry();
    expect(() =>
      registry.register({
        name: "ping",
        description: "d",
        execute: undefined as never,
      }),
    ).toThrowError(FrameworkError);
    expect(() =>
      registry.register({ name: "ping", description: "", execute: noop }),
    ).toThrowError(FrameworkError);
  });
});
