# `@discord-framework/core`

Application architecture for Discord bots. No discord.js dependency — the
transport is injected via the `Connector` interface (implemented by
`@discord-framework/discord`).

## API

```ts
import { Bot, defineCommand, createLogger } from "@discord-framework/core";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });

bot.use(async (ctx, next) => {
  ctx.logger.debug({ event: "command.received" }, "incoming");
  await next();
});

bot.command(
  defineCommand({
    name: "ping",
    description: "Replies with Pong!",
    async execute(ctx) {
      ctx.services.get<string>("greeting"); // DI-lite
      await ctx.reply("Pong!");
    },
  }),
);

bot.on("afterStart", () => console.log("ready"));
await bot.start(); // lifecycle: beforeStart → connector.start → afterStart
await bot.stop();  // graceful shutdown within shutdownTimeoutMs
```

## Notes

- Registration validates eagerly (`bot.command` throws on duplicates/bad
  names); dispatch is a `Map.get` plus the middleware chain.
- `handleInteraction` never throws — failures are logged with
  `command/interactionId/guildId/channelId/userId/requestId/durationMs` and
  returned as `{ ok: false, error }`.
- Errors are `FrameworkError`s with stable `FRAMEWORK_*` codes, categories,
  and probabilistic diagnostics (`likelyCause` + `suggestedInvestigation`).
- Tokens and auth headers are redacted from logs.
- `ctx.interaction` / `ctx.client` are escape hatches to raw discord.js objects.
