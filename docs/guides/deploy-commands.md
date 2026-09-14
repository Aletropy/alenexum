---
title: Deploy commands
description: Push slash and context-menu definitions to Discord via REST — guild, global, or skip.
---

# Deploy commands

Registration (`bot.command(...)`) is local. **Deployment** pushes definitions to Discord over REST. The two are separate steps on purpose: you can restart routing without re-deploying, and deploy without restarting.

## How it works

`@nexum/discord` converts definitions to Discord JSON:

- `toSlashCommandJSON(def)` — via `SlashCommandBuilder`, all nine option types, `choices` (1–25) validation, `choices` + `autocomplete` mutual exclusion, `defaultMemberPermissions` decimal-string validation. Violations throw `FRAMEWORK_INVALID_CONFIGURATION` at deploy time, not at runtime.
- `toContextMenuJSON(def)` — via `ContextMenuCommandBuilder` (type 2 = user, 3 = message).
- `collectDeployBody(bot)` — combines slash + context-menu bodies for one `REST.put`.

`connector.deployCommands()` honors `deploy.mode`:

| Mode | Route | Use |
|---|---|---|
| `guild` | `applicationGuildCommands(appId, guildId)` | Development — propagates instantly. Requires `guildId`. |
| `global` | `applicationCommands(appId)` | Production — propagates slowly (up to ~1 h). |
| `skip` | nothing | Tests, local routing work, or externally managed deploys. |

```ts
const connector = createDiscordConnector(bot, {
  intents: [GatewayIntentBits.Guilds],
  deploy: { mode: "guild", guildId: process.env.GUILD_ID },
});
bot.attachConnector(connector);
await bot.start();
await connector.deployCommands(); // after login: applicationId is known
```

Deploying before login throws `FRAMEWORK_INVALID_CONFIGURATION` (application id unknown); `guild` mode without `guildId` throws with a diagnostic pointing at `GUILD_ID`. The sandbox defaults to `guild` when `GUILD_ID` is set, else `skip`.
