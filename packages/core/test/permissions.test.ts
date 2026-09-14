import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { createLogger } from "../src/logger.js";
import {
  requireBotPermissions,
  requireGuild,
  requireRoles,
  requireUserIds,
  requireUserPermissions,
} from "../src/permissions.js";
import { createFakeInteraction } from "./helpers.js";

const BAN = 4n;
const MANAGE = 8n;

function checkCtx(overrides: Record<string, unknown> = {}) {
  return {
    route: "test",
    requestId: "r1",
    interactionId: "i1",
    guildId: "g1",
    channelId: "c1",
    userId: "u1",
    logger: createLogger({ level: "silent" }),
    interaction: createFakeInteraction(),
    ...overrides,
  } as never;
}

describe("requireGuild", () => {
  it("allows guilds and denies DMs", async () => {
    expect(await requireGuild().check(checkCtx())).toBe(true);
    const denied = await requireGuild().check(checkCtx({ guildId: null }));
    expect(denied).toMatchObject({ allowed: false });
    const custom = await requireGuild({ message: "guilds only" }).check(
      checkCtx({ guildId: null }),
    );
    expect(custom).toEqual({ allowed: false, message: "guilds only" });
  });
});

describe("requireUserPermissions", () => {
  it("allows granted bits and denies missing ones", async () => {
    const allow = requireUserPermissions(BAN);
    expect(
      await allow.check(
        checkCtx({
          interaction: createFakeInteraction({ memberPermissions: [BAN] }),
        }),
      ),
    ).toBe(true);
    expect(
      await allow.check(
        checkCtx({
          interaction: createFakeInteraction({ memberPermissions: [MANAGE] }),
        }),
      ),
    ).toMatchObject({ allowed: false });
  });

  it("is fail-closed when permissions are unreadable", async () => {
    const guard = requireUserPermissions(BAN);
    expect(
      await guard.check(checkCtx({ interaction: createFakeInteraction() })),
    ).toMatchObject({
      allowed: false,
    });
    expect(await guard.check(checkCtx({ interaction: {} }))).toMatchObject({
      allowed: false,
    });
  });

  it("supports multiple required bits", async () => {
    const guard = requireUserPermissions([BAN, MANAGE]);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({
            memberPermissions: [BAN, MANAGE],
          }),
        }),
      ),
    ).toBe(true);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ memberPermissions: [BAN] }),
        }),
      ),
    ).toMatchObject({ allowed: false });
  });
});

describe("requireBotPermissions", () => {
  it("reads appPermissions and fails closed", async () => {
    const guard = requireBotPermissions(BAN);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ appPermissions: [BAN] }),
        }),
      ),
    ).toBe(true);
    expect(
      await guard.check(checkCtx({ interaction: createFakeInteraction() })),
    ).toMatchObject({
      allowed: false,
    });
  });
});

describe("requireRoles", () => {
  it("matches array-shaped roles", async () => {
    const guard = requireRoles(["r1", "r2"]);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ memberRoles: ["r9", "r2"] }),
        }),
      ),
    ).toBe(true);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ memberRoles: ["r9"] }),
        }),
      ),
    ).toMatchObject({ allowed: false });
  });

  it("matches manager-shaped roles via has() and keys()", async () => {
    const guard = requireRoles(["r1"]);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ memberRoleCache: ["r1"] }),
        }),
      ),
    ).toBe(true);
    expect(
      await guard.check(
        checkCtx({
          interaction: createFakeInteraction({ memberRoleKeysOnly: ["r1"] }),
        }),
      ),
    ).toBe(true);
    expect(
      await guard.check(checkCtx({ interaction: createFakeInteraction() })),
    ).toMatchObject({
      allowed: false,
    });
  });
});

describe("requireUserIds", () => {
  it("allow-lists users", async () => {
    const guard = requireUserIds(["owner"]);
    expect(await guard.check(checkCtx({ userId: "owner" }))).toBe(true);
    expect(await guard.check(checkCtx({ userId: "stranger" }))).toMatchObject({
      allowed: false,
    });
    expect(await guard.check(checkCtx({ userId: undefined }))).toMatchObject({
      allowed: false,
    });
  });
});

describe("permission dispatch", () => {
  it("denies DM usage of a guild-only command", async () => {
    const bot = new Bot({
      token: "t",
      logger: createLogger({ level: "silent" }),
    });
    bot.command({
      name: "server",
      description: "Server",
      guards: [requireGuild()],
      execute: async (ctx) => {
        await ctx.reply("guild!");
      },
    });
    const dm = createFakeInteraction({ commandName: "server", guildId: null });
    const result = await bot.handleInteraction(dm);
    expect(result).toMatchObject({ ok: true, command: "server" });
    expect(dm.replies).toEqual(["This cannot be used in direct messages."]);
  });
});
