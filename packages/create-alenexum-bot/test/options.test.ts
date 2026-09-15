import { describe, expect, it } from "vitest";
import {
  intentsSnippet,
  isPackageManager,
  parseArgs,
  sanitizeProjectName,
} from "../src/options.js";

describe("sanitizeProjectName", () => {
  it("lowercases and passes through valid names", () => {
    expect(sanitizeProjectName("my-bot")).toBe("my-bot");
  });

  it("folds underscores and whitespace into hyphens while lowercasing", () => {
    expect(sanitizeProjectName("My_Bot")).toBe("my-bot");
  });

  it("collapses whitespace and underscores into hyphens", () => {
    expect(sanitizeProjectName("  my   cool  bot  ")).toBe("my-cool-bot");
  });

  it("strips illegal characters", () => {
    expect(sanitizeProjectName("my@bot!.js")).toBe("mybotjs");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(sanitizeProjectName("--my--bot--")).toBe("my-bot");
  });

  it("truncates to 214 characters", () => {
    const long = "a".repeat(300);
    expect(sanitizeProjectName(long)).toHaveLength(214);
  });

  it("throws for names that sanitize to empty (only illegal characters)", () => {
    expect(() => sanitizeProjectName("@@@")).toThrow(/Invalid project name/);
  });

  it("throws for names that sanitize to empty (only separators)", () => {
    expect(() => sanitizeProjectName("___")).toThrow(/Invalid project name/);
  });
});

describe("isPackageManager", () => {
  it("accepts the four supported managers", () => {
    expect(isPackageManager("npm")).toBe(true);
    expect(isPackageManager("pnpm")).toBe(true);
    expect(isPackageManager("yarn")).toBe(true);
    expect(isPackageManager("bun")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPackageManager("deno")).toBe(false);
    expect(isPackageManager("")).toBe(false);
  });
});

describe("parseArgs", () => {
  it("parses a bare project name", () => {
    expect(parseArgs(["my-bot"])).toEqual({ name: "my-bot", flags: {} });
  });

  it("parses every boolean flag", () => {
    const { flags } = parseArgs([
      "-y",
      "-f",
      "--no-install",
      "--no-git",
      "--no-token",
    ]);
    expect(flags).toEqual({
      yes: true,
      force: true,
      install: false,
      git: false,
      noToken: true,
    });
  });

  it("parses --help / -h", () => {
    expect(parseArgs(["--help"]).flags.help).toBe(true);
    expect(parseArgs(["-h"]).flags.help).toBe(true);
  });

  it("parses --pm=<manager>", () => {
    expect(parseArgs(["--pm=pnpm"]).flags.packageManager).toBe("pnpm");
  });

  it("rejects an invalid --pm value", () => {
    expect(() => parseArgs(["--pm=deno"])).toThrow(/Invalid --pm/);
  });

  it("parses --token <value>", () => {
    expect(parseArgs(["--token", "abc123"]).flags.token).toBe("abc123");
  });

  it("throws when --token is missing its value", () => {
    expect(() => parseArgs(["--token"])).toThrow(/Missing value: --token/);
    expect(() => parseArgs(["--token", "--yes"])).toThrow(
      /Missing value: --token/,
    );
  });

  it("throws on an unknown flag", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown flag/);
  });

  it("throws on more than one positional argument", () => {
    expect(() => parseArgs(["my-bot", "extra"])).toThrow(
      /Unexpected positional argument/,
    );
  });

  it("combines a name with flags in any order", () => {
    const { name, flags } = parseArgs(["--pm=yarn", "my-bot", "-y"]);
    expect(name).toBe("my-bot");
    expect(flags).toEqual({ packageManager: "yarn", yes: true });
  });
});

describe("intentsSnippet", () => {
  it("returns Guilds-only for minimal", () => {
    expect(intentsSnippet("minimal")).toBe("[GatewayIntentBits.Guilds]");
  });

  it("returns the full set for standard, pre-wrapped for the formatter", () => {
    expect(intentsSnippet("standard")).toBe(
      [
        "[",
        "    GatewayIntentBits.Guilds,",
        "    GatewayIntentBits.GuildMessages,",
        "    GatewayIntentBits.MessageContent,",
        "  ]",
      ].join("\n"),
    );
  });
});
