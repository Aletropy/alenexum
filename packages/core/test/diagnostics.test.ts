import { describe, expect, it } from "vitest";
import { FrameworkError, formatFrameworkError } from "../src/errors.js";

describe("formatFrameworkError", () => {
  it("renders code, message, context, cause, and diagnostics", () => {
    const error = new FrameworkError({
      code: "FRAMEWORK_COMMAND_HANDLER_FAILED",
      category: "Application",
      message: "Command failed",
      context: {
        subsystem: "dispatch",
        command: "ping",
        requestId: "r1",
        missing: undefined,
      },
      cause: new TypeError("bad input"),
      diagnostic: {
        likelyCause: "The handler threw.",
        suggestedInvestigation: ["Read the stack.", "Reproduce locally."],
      },
    });
    const report = formatFrameworkError(error);
    expect(report).toContain(
      "[FRAMEWORK_COMMAND_HANDLER_FAILED] (Application) Command failed",
    );
    expect(report).toContain("command: ping");
    expect(report).toContain("requestId: r1");
    expect(report).not.toContain("missing");
    expect(report).toContain("Caused by TypeError: bad input");
    expect(report).toContain("Likely cause: The handler threw.");
    expect(report).toContain("1. Read the stack.");
    expect(report).toContain("2. Reproduce locally.");
  });

  it("handles errors without diagnostics and non-framework values", () => {
    const bare = new FrameworkError({
      code: "FRAMEWORK_INTERNAL",
      category: "Internal",
      message: "x",
    });
    expect(formatFrameworkError(bare)).toBe(
      "[FRAMEWORK_INTERNAL] (Internal) x",
    );
    expect(formatFrameworkError(new Error("plain"))).toBe("Error: plain");
    expect(formatFrameworkError("oops")).toBe("UnknownError: oops");
    expect(formatFrameworkError(undefined)).toBe(
      "UnknownError: Unknown error value",
    );
  });

  it("caps nested causes and stringifies complex context", () => {
    const deep = new Error("l1", {
      cause: new Error("l2", { cause: new Error("l3") }),
    });
    const report = formatFrameworkError(deep);
    expect(report).toContain("Error: l1");
    expect(report).toContain("Caused by Error: l2");
    expect(report).toContain("Caused by Error: l3");
    const withComplex = new FrameworkError({
      code: "FRAMEWORK_INTERNAL",
      category: "Internal",
      message: "x",
      context: { extra: { nested: true }, count: 3, empty: null },
    });
    const rendered = formatFrameworkError(withComplex);
    expect(rendered).toContain('extra: {"nested":true}');
    expect(rendered).toContain("count: 3");
    expect(rendered).toContain("empty: null");
  });
});
