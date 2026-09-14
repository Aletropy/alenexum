---
title: "API: @alenexum/discord"
description: Discord transport adapter and REST deployment reference.
---

# API: `@alenexum/discord`

Thin adapter over discord.js. Dependencies: `@alenexum/core`, `discord.js`.

```ts
import { createDiscordConnector } from "@alenexum/discord";
```

| Export | Kind | Purpose |
|---|---|---|
| `createDiscordConnector(bot, options)` | function | Build the connector. `options: DiscordConnectorOptions { intents, clientOptions?, deploy? }`. |
| `DiscordConnector` | interface | `Connector` + `client: Client` + `deployCommands(): Promise<void>`. |
| `DiscordConnectorOptions` | interface | Above; `clientOptions` passes partials etc. through (intents come from `intents`). |
| `DeployOptions` | interface | `{ mode: "guild" \| "global" \| "skip", guildId? }`. |
| `toSlashCommandJSON(def)` | function | `CommandDefinition` → `SlashCommandBuilder` JSON. Validates choices/counts, choices⊕autocomplete, permissions string. |
| `toContextMenuJSON(def)` | function | `ContextMenuDefinition` → builder JSON (type 2/3). |
| `collectDeployBody(bot)` | function | Combined `unknown[]` body for `REST.put`. |

**Behavior:** `start()` attaches `interactionCreate → bot.handleInteraction` once, then `client.login(token)`; `stop()` destroys the client. `deployCommands()` no-ops on `skip`, requires post-login application id, requires `guildId` in `guild` mode — violations throw `FRAMEWORK_INVALID_CONFIGURATION`. **Limits:** single `Client` per connector; sharding lives in `@alenexum/sharding`.

Guide: [Deploy commands](../guides/deploy-commands.md).

## Export index

`createDiscordConnector`, `DiscordConnector`, `DiscordConnectorOptions`, `DeployOptions`, `toSlashCommandJSON`, `toContextMenuJSON`, `collectDeployBody`.
