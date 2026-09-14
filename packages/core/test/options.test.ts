import { describe, expect, it } from "vitest";
import { FrameworkError } from "../src/errors.js";
import {
  attachmentOption,
  booleanOption,
  channelOption,
  integerOption,
  mentionableOption,
  numberOption,
  parseOptions,
  roleOption,
  stringOption,
  userOption,
} from "../src/options.js";
import { FakeOptionResolver } from "./helpers.js";

const CTX = { command: "test", requestId: "r1" };

describe("option builders", () => {
  it("produce data schemas", () => {
    expect(stringOption({ description: "s" })).toEqual({
      type: "string",
      description: "s",
    });
    expect(
      integerOption({
        description: "i",
        required: true,
        minValue: 1,
        maxValue: 5,
      }),
    ).toEqual({
      type: "integer",
      description: "i",
      required: true,
      minValue: 1,
      maxValue: 5,
    });
    expect(userOption({ description: "u" }).type).toBe("user");
    expect(booleanOption({ description: "b" }).type).toBe("boolean");
    expect(numberOption({ description: "n" }).type).toBe("number");
    expect(channelOption({ description: "c" }).type).toBe("channel");
    expect(roleOption({ description: "r" }).type).toBe("role");
    expect(mentionableOption({ description: "m" }).type).toBe("mentionable");
    expect(attachmentOption({ description: "a" }).type).toBe("attachment");
  });
});

describe("parseOptions", () => {
  it("parses primitives and passes entities through", () => {
    const resolver = new FakeOptionResolver({
      text: "hi",
      count: 3,
      ratio: 1.5,
      flag: true,
      target: { id: "u1" },
      channel: { id: "c1" },
      role: { id: "r1" },
      mention: { id: "m1" },
      file: { id: "a1", url: "https://cdn/x.png" },
    });
    const values = parseOptions(
      { options: resolver },
      {
        text: stringOption({ description: "s" }),
        count: integerOption({ description: "i" }),
        ratio: numberOption({ description: "n" }),
        flag: booleanOption({ description: "b" }),
        target: userOption({ description: "u" }),
        channel: channelOption({ description: "c" }),
        role: roleOption({ description: "r" }),
        mention: mentionableOption({ description: "m" }),
        file: attachmentOption({ description: "a" }),
      },
      CTX,
    );
    expect(values).toEqual({
      text: "hi",
      count: 3,
      ratio: 1.5,
      flag: true,
      target: { id: "u1" },
      channel: { id: "c1" },
      role: { id: "r1" },
      mention: { id: "m1" },
      file: { id: "a1", url: "https://cdn/x.png" },
    });
  });

  it("yields undefined for missing optional options", () => {
    const values = parseOptions(
      { options: new FakeOptionResolver({}) },
      {
        text: stringOption({ description: "s" }),
        count: integerOption({ description: "i" }),
      },
      CTX,
    );
    expect(values).toEqual({ text: undefined, count: undefined });
  });

  it("returns {} for commands without a schema", () => {
    expect(
      parseOptions({ options: new FakeOptionResolver({}) }, undefined, CTX),
    ).toEqual({});
    expect(
      parseOptions({}, { text: stringOption({ description: "s" }) }, CTX),
    ).toEqual({
      text: undefined,
    });
  });

  it("rejects missing required options with FRAMEWORK_COMMAND_VALIDATION_FAILED", () => {
    try {
      parseOptions(
        { options: new FakeOptionResolver({}) },
        { text: stringOption({ description: "s", required: true }) },
        CTX,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FrameworkError);
      const err = error as FrameworkError;
      expect(err.code).toBe("FRAMEWORK_COMMAND_VALIDATION_FAILED");
      expect(err.category).toBe("Validation");
      expect(err.context.option).toBe("text");
      expect(err.diagnostic?.suggestedInvestigation.length).toBeGreaterThan(0);
    }
  });

  it("enforces choices, ranges, and lengths", () => {
    const schema = {
      color: stringOption({
        description: "s",
        choices: [{ name: "Red", value: "red" }],
      }),
      count: integerOption({ description: "i", minValue: 1, maxValue: 5 }),
      text: stringOption({ description: "s", minLength: 2, maxLength: 4 }),
    } as const;
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ color: "blue" }) },
        schema,
        CTX,
      ),
    ).toThrowError(FrameworkError);
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ count: 9 }) },
        schema,
        CTX,
      ),
    ).toThrowError(FrameworkError);
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ text: "x" }) },
        schema,
        CTX,
      ),
    ).toThrowError(FrameworkError);
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ text: "toolong" }) },
        schema,
        CTX,
      ),
    ).toThrowError(FrameworkError);
    // Valid values pass.
    expect(
      parseOptions(
        {
          options: new FakeOptionResolver({
            color: "red",
            count: 3,
            text: "ok",
          }),
        },
        schema,
        CTX,
      ),
    ).toEqual({ color: "red", count: 3, text: "ok" });
  });

  it("rejects wrong runtime types and malformed entities", () => {
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ count: 1.5 }) },
        { count: integerOption({ description: "i" }) },
        CTX,
      ),
    ).toThrowError(FrameworkError);
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ target: { nope: true } }) },
        { target: userOption({ description: "u", required: true }) },
        CTX,
      ),
    ).toThrowError(FrameworkError);
    expect(() =>
      parseOptions(
        { options: new FakeOptionResolver({ file: { id: "a1" } }) },
        { file: attachmentOption({ description: "a", required: true }) },
        CTX,
      ),
    ).toThrowError(FrameworkError);
  });
});
