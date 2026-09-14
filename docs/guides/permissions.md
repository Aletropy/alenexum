---
title: Permissions
description: Gate commands with fail-closed guard factories.
---

# Permissions

Permissions are guards (`fundamentals/middleware-guards.md`): allow/deny decisions with user-facing messages, evaluated before middleware. All factories are **fail-closed** — unreadable shapes deny, never allow.

```ts
import { requireGuild, requireUserPermissions, requireRoles } from "@alenexum/core";
import { PermissionFlagsBits } from "discord.js";

bot.command({
  name: "server",
  description: "Server info",
  guards: [requireGuild({ message: "Use this inside a server." })],
  async execute(ctx) {
    await ctx.reply(`Guild: ${ctx.guildId}`);
  },
});

bot.command({
  name: "ban",
  description: "Ban a member",
  guards: [
    requireGuild(),
    requireUserPermissions(PermissionFlagsBits.BanMembers),
    requireRoles(["admin-role-id"]),
  ],
  async execute(ctx) {
    // ...
  },
});
```

Notes:

- `requireUserPermissions` accepts one `bigint` or an array; it reads `memberPermissions.has` from the raw interaction. `requireBotPermissions` mirrors it against `appPermissions`.
- `requireRoles` accepts discord.js role collections (`cache.has` / `keys()`) as well as plain `string[]`.
- `requireUserIds([...])` implements owner-only commands.
- Global guards (`bot.guard(...)`) run before per-command guards — put universal policy (guild-only, blocklist) globally, feature policy per command.
- Discord-level `defaultMemberPermissions` (set on the command definition, deployed via REST) hides commands in the client; framework guards enforce at runtime. Use both: the former is UX, the latter is the security boundary. Neither replaces Discord role/permission setup — that remains a **Discord responsibility**.
