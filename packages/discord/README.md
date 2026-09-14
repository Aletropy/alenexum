# `@discord-framework/discord`

Thin transport adapter over discord.js. Owns nothing but adaptation:

- `createDiscordConnector(bot, { intents, clientOptions, deploy })` returns a
  core `Connector`: login on `start()`, `interactionCreate` →
  `bot.handleInteraction()`, destroy on `stop()`.
- `connector.deployCommands()` pushes registered commands via Discord REST
  (`guild` for instant dev deploy, `global` for production, `skip` default).

Gateway, REST, rate limits, and caches stay 100% discord.js.
