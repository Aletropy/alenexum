import {
  attachmentOption,
  Bot,
  booleanOption,
  channelOption,
  createLogger,
  defineCommand,
  defineContextMenu,
  FrameworkError,
  integerOption,
  mentionableOption,
  numberOption,
  roleOption,
  stringOption,
  userOption,
} from "@nexum/core";
import { describe, expect, it } from "vitest";
import {
  collectDeployBody,
  toContextMenuJSON,
  toSlashCommandJSON,
} from "../src/deploy.js";

describe("toSlashCommandJSON", () => {
  it("maps all nine option types with required flags", () => {
    const command = defineCommand({
      name: "demo",
      description: "Demo",
      options: {
        text: stringOption({ description: "s", required: true }),
        count: integerOption({ description: "i" }),
        ratio: numberOption({ description: "n", required: true }),
        flag: booleanOption({ description: "b" }),
        target: userOption({ description: "u", required: true }),
        channel: channelOption({ description: "c" }),
        role: roleOption({ description: "r" }),
        mention: mentionableOption({ description: "m" }),
        file: attachmentOption({ description: "a" }),
      },
      execute: () => {},
    });
    const json = toSlashCommandJSON(command);
    expect(json.name).toBe("demo");
    expect(json.description).toBe("Demo");
    const byName = new Map(
      (json.options ?? []).map((option) => [option.name, option]),
    );
    expect(byName.get("text")).toMatchObject({ type: 3, required: true });
    expect(byName.get("count")).toMatchObject({ type: 4, required: false });
    expect(byName.get("ratio")).toMatchObject({ type: 10, required: true });
    expect(byName.get("flag")).toMatchObject({ type: 5 });
    expect(byName.get("target")).toMatchObject({ type: 6, required: true });
    expect(byName.get("channel")).toMatchObject({ type: 7 });
    expect(byName.get("role")).toMatchObject({ type: 8 });
    expect(byName.get("mention")).toMatchObject({ type: 9 });
    expect(byName.get("file")).toMatchObject({ type: 11 });
  });

  it("carries choices, bounds, and autocomplete", () => {
    const command = defineCommand({
      name: "pick",
      description: "Pick",
      options: {
        color: stringOption({
          description: "s",
          choices: [
            { name: "Red", value: "red" },
            { name: "Blue", value: "blue" },
          ],
          minLength: 3,
          maxLength: 4,
        }),
        query: stringOption({ description: "q", autocomplete: true }),
        count: integerOption({
          description: "i",
          minValue: 1,
          maxValue: 5,
          choices: [{ name: "One", value: 1 }],
        }),
      },
      execute: () => {},
    });
    const json = toSlashCommandJSON(command);
    const byName = new Map(
      (json.options ?? []).map((option) => [option.name, option]),
    );
    expect(byName.get("color")).toMatchObject({
      choices: [
        { name: "Red", value: "red" },
        { name: "Blue", value: "blue" },
      ],
      min_length: 3,
      max_length: 4,
    });
    expect(byName.get("query")).toMatchObject({ autocomplete: true });
    expect(byName.get("count")).toMatchObject({
      choices: [{ name: "One", value: 1 }],
      min_value: 1,
      max_value: 5,
    });
  });

  it("emits option-less commands without an options key", () => {
    const json = toSlashCommandJSON(
      defineCommand({ name: "ping", description: "Ping", execute: () => {} }),
    );
    expect(json).toMatchObject({ name: "ping", description: "Ping" });
    expect(json.options ?? []).toHaveLength(0);
  });

  it("rejects empty and oversized choice lists at deploy time", () => {
    const empty = defineCommand({
      name: "bad",
      description: "Bad",
      options: { text: stringOption({ description: "s", choices: [] }) },
      execute: () => {},
    });
    expect(() => toSlashCommandJSON(empty)).toThrowError(FrameworkError);
    try {
      toSlashCommandJSON(empty);
    } catch (error) {
      expect((error as FrameworkError).code).toBe(
        "FRAMEWORK_INVALID_CONFIGURATION",
      );
    }
    const oversized = defineCommand({
      name: "bad",
      description: "Bad",
      options: {
        text: stringOption({
          description: "s",
          choices: Array.from({ length: 26 }, (_, index) => ({
            name: `c${index}`,
            value: `v${index}`,
          })),
        }),
      },
      execute: () => {},
    });
    expect(() => toSlashCommandJSON(oversized)).toThrowError(FrameworkError);
  });

  it("rejects choices combined with autocomplete", () => {
    const both = defineCommand({
      name: "bad",
      description: "Bad",
      options: {
        text: stringOption({
          description: "s",
          autocomplete: true,
          choices: [{ name: "A", value: "a" }],
        }),
      },
      execute: () => {},
    });
    try {
      toSlashCommandJSON(both);
      expect.unreachable();
    } catch (error) {
      expect((error as FrameworkError).code).toBe(
        "FRAMEWORK_INVALID_CONFIGURATION",
      );
    }
  });
});

describe("toContextMenuJSON", () => {
  it("maps user and message commands to types 2 and 3", () => {
    const user = toContextMenuJSON(
      defineContextMenu({
        type: "user",
        name: "Get avatar",
        execute: () => {},
      }),
    );
    expect(user).toMatchObject({ name: "Get avatar", type: 2 });
    const message = toContextMenuJSON(
      defineContextMenu({ type: "message", name: "Quote", execute: () => {} }),
    );
    expect(message).toMatchObject({ name: "Quote", type: 3 });
  });
});

describe("collectDeployBody", () => {
  it("combines slash and context-menu commands", () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    bot.command(
      defineCommand({ name: "ping", description: "Ping", execute: () => {} }),
    );
    bot.contextMenu(
      defineContextMenu({
        type: "user",
        name: "Get avatar",
        execute: () => {},
      }),
    );
    const body = collectDeployBody(bot) as Record<string, unknown>[];
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ name: "ping", type: 1 });
    expect(body[1]).toMatchObject({ name: "Get avatar", type: 2 });
  });
});

describe("defaultMemberPermissions", () => {
  it("passes bitfield strings through for slash and menu commands", () => {
    const slash = toSlashCommandJSON(
      defineCommand({
        name: "ban",
        description: "Ban",
        defaultMemberPermissions: "4",
        execute: () => {},
      }),
    );
    expect(slash).toMatchObject({ default_member_permissions: "4" });
    const menu = toContextMenuJSON(
      defineContextMenu({
        type: "user",
        name: "Mod",
        defaultMemberPermissions: "0",
        execute: () => {},
      }),
    );
    expect(menu).toMatchObject({ default_member_permissions: "0" });
  });

  it("omits the field when unset and rejects malformed values", () => {
    const plain = toSlashCommandJSON(
      defineCommand({ name: "ping", description: "Ping", execute: () => {} }),
    );
    expect(
      plain.default_member_permissions === undefined ||
        plain.default_member_permissions === null,
    ).toBe(true);
    const bad = defineCommand({
      name: "ban",
      description: "Ban",
      defaultMemberPermissions: "BanMembers",
      execute: () => {},
    });
    try {
      toSlashCommandJSON(bad);
      expect.unreachable();
    } catch (error) {
      expect((error as FrameworkError).code).toBe(
        "FRAMEWORK_INVALID_CONFIGURATION",
      );
    }
  });
});
