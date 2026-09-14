import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_ERROR_CODES,
  FrameworkError,
  isFrameworkError,
  serializeError,
  toFrameworkError,
} from "../src/errors.js";

describe("FrameworkError", () => {
  it("carries stable codes", () => {
    expect(FRAMEWORK_ERROR_CODES).toContain("FRAMEWORK_COMMAND_HANDLER_FAILED");
    expect(FRAMEWORK_ERROR_CODES).toContain("FRAMEWORK_ROUTE_NOT_FOUND");
    expect(FRAMEWORK_ERROR_CODES).toContain(
      "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED",
    );
    expect(FRAMEWORK_ERROR_CODES).toContain("FRAMEWORK_INVALID_CONFIGURATION");
    expect(FRAMEWORK_ERROR_CODES).toContain(
      "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
    );
  });

  it("preserves code, category, context, cause, and diagnostic", () => {
    const cause = new Error("root cause");
    const error = new FrameworkError({
      code: "FRAMEWORK_COMMAND_HANDLER_FAILED",
      category: "Application",
      message: "boom",
      context: { subsystem: "dispatch", command: "ping", requestId: "r1" },
      cause,
      diagnostic: { likelyCause: "test", suggestedInvestigation: ["step 1"] },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("FrameworkError");
    expect(error.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
    expect(error.context.requestId).toBe("r1");
    expect(error.cause).toBe(cause);
    expect(error.diagnostic?.likelyCause).toBe("test");
    expect(error.toJSON().code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
  });

  it("isFrameworkError narrows correctly", () => {
    expect(isFrameworkError(new Error("x"))).toBe(false);
    expect(isFrameworkError("x")).toBe(false);
    expect(
      isFrameworkError(
        new FrameworkError({
          code: "FRAMEWORK_INTERNAL",
          category: "Internal",
          message: "x",
        }),
      ),
    ).toBe(true);
  });

  it("toFrameworkError passes FrameworkErrors through untouched", () => {
    const original = new FrameworkError({
      code: "FRAMEWORK_ROUTE_NOT_FOUND",
      category: "Application",
      message: "missing",
    });
    expect(
      toFrameworkError(
        "FRAMEWORK_COMMAND_HANDLER_FAILED",
        "Application",
        "wrapped",
        original,
      ),
    ).toBe(original);
  });

  it("toFrameworkError wraps unknown values with cause preserved", () => {
    const cause = new TypeError("bad");
    const wrapped = toFrameworkError(
      "FRAMEWORK_COMMAND_HANDLER_FAILED",
      "Application",
      "Command failed",
      cause,
      { command: "ping" },
    );
    expect(wrapped.code).toBe("FRAMEWORK_COMMAND_HANDLER_FAILED");
    expect(wrapped.message).toContain("Command failed");
    expect(wrapped.message).toContain("bad");
    expect(wrapped.cause).toBe(cause);
  });

  it("serializeError never throws and keeps framework codes", () => {
    expect(serializeError("plain string")).toEqual({
      name: "UnknownError",
      message: "plain string",
    });
    expect(serializeError(undefined).name).toBe("UnknownError");
    const err = serializeError(
      new FrameworkError({
        code: "FRAMEWORK_INTERNAL",
        category: "Internal",
        message: "x",
      }),
    );
    expect(err.code).toBe("FRAMEWORK_INTERNAL");
    expect(typeof err.stack).toBe("string");
  });
});
