# `@alenexum/discord`

Thin transport adapter over discord.js. Owns nothing but adaptation:

## Installation

```bash
npm install @alenexum/discord discord.js
```

- `createDiscordConnector(bot, { intents, clientOptions, deploy })` returns a
  core `Connector`: login on `start()`, `interactionCreate` →
  `bot.handleInteraction()`, destroy on `stop()`.
- `connector.deployCommands()` pushes registered commands via Discord REST
  (`guild` for instant dev deploy, `global` for production, `skip` default).
- `toSlashCommandJSON(definition)` converts the core option schema to
  discord.js builder payloads (types, required, choices, min/max,
  autocomplete). Schema bugs (empty/oversized choices, choices +
  autocomplete together) fail with `FRAMEWORK_INVALID_CONFIGURATION`
  instead of a raw API 400.
- `toContextMenuJSON(definition)` maps user/message commands (types 2/3);
  `collectDeployBody(bot)` combines slash + context-menu payloads for
  `deployCommands()`.
- `defaultMemberPermissions` (decimal bitfield string, e.g.
  `String(PermissionFlagsBits.BanMembers)`) is deployed verbatim for
  client-side gating and validated at deploy time.

Gateway, REST, rate limits, and caches stay 100% discord.js.
