---
title: Sandbox tour
description: Run apps/sandbox-bot — the living stress harness — and learn what it proves.
---

# Sandbox tour

`apps/sandbox-bot` is the framework's **living stress harness**, not a toy. It exercises boot → login → REST deploy → routing → middleware → handler → reply → structured logs, plus slow/timeout/concurrency/failure-injection scenarios.

## Setup

```bash
cp apps/sandbox-bot/.env.example apps/sandbox-bot/.env
# fill in DISCORD_TOKEN and GUILD_ID
pnpm install
pnpm --filter sandbox-bot dev
```

Environment variables (see [reference](../reference/environment-variables.md)):

| Variable | Meaning |
|---|---|
| `DISCORD_TOKEN` | Required. Bot token, env-only. |
| `GUILD_ID` | Dev guild for instant command deployment. Empty means `skip` mode. |
| `DEPLOY_MODE` | `guild` \| `global` \| `skip`. Defaults to `guild` when `GUILD_ID` is set, else `skip`. |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error`. Default `info`. |

## How it is wired (`apps/sandbox-bot/src/index.ts`)

```ts
const metrics = createDispatchMetrics();
const health = new HealthMonitor();
const bot = new Bot({
  token,
  logger: createLogger({ level: logLevel, pretty: process.env.NODE_ENV !== "production" }),
  observer: metrics.observer,
});
bot.services.register("metrics", metrics);
bot.services.register("health", health);
bot.services.register("bot", bot);

const scheduler = new JobScheduler({
  logger: bot.logger.child({ subsystem: "jobs" }),
  services: bot.services,
});
bot.services.register("scheduler", scheduler);

await loadMiddleware(bot, src("middleware"));
await loadCommands(bot, src("commands"));
await loadComponents(bot, src("components"));
await loadModals(bot, src("modals"));
await loadAutocomplete(bot, src("autocomplete"));
await loadContextMenus(bot, src("context-menus"));
await loadJobs(scheduler, bot.logger, src("jobs"));
await loadPlugins(bot, src("plugins"));
await bot.plugin(jobsPlugin(scheduler));
await loadModules(bot, src("modules"));

const connector = createDiscordConnector(bot, {
  intents: [GatewayIntentBits.Guilds],
  deploy: { mode: deployMode, guildId },
});
bot.attachConnector(connector);
health.register("discord", discordClientCheck(connector.client));

await bot.start();
await connector.deployCommands();
```

Note the order: observability and services first, explicit bulk loading (bootstrap only), lifecycle-bound jobs plugin, connector last, deploy after login.

## What it covers

| Area | Scenarios |
|---|---|
| Slash commands | `ping` (happy path), `add` (typed integers), `echo` (string bounds + per-user cooldown), `userinfo` (user entity), `server` (`requireGuild` guard) |
| Components | `vote` (button prefix routing + `ctx.update`), `color` (string select + `ctx.values`), `poll` (quiet `deferUpdate` + discord.js collector) |
| Modals | `feedback` modal → `ctx.fields.get("message")` |
| Autocomplete | `search` with prefix-filtered fruit list, ≤ 25 choices |
| Context menus | `Get avatar` (user), `Quote message` (message) |
| Middleware / plugins / modules | Request logger middleware, audit-plugin guard, greetings module (service + command) |
| Jobs | `heartbeat` every 30 s with timeout; `/jobs` inspects scheduler stats |
| Failure injection | `boom` (throws → error boundary + recovery reply), `slow` (defer + followUp), `flood` (parallel followUps), `timeout` (8 s deferred), `dupe` (double-ack → `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED`) |
| Observability | `/stats` (dispatch counters/histograms), `/health` (monitor + uptime + active dispatches) |

## Adding a scenario

1. Add a file under the matching `src/<kind>/` directory with a default export (`defineCommand`, `defineComponent`, `defineModal`, `defineAutocomplete`, array for context menus, middleware function, `definePlugin`, `defineModule`, or `defineJob`).
2. Files load in **sorted order** via the matching `load*` call — no registration code to update.
3. Every module is validated as `unknown`; failures are fail-fast `FRAMEWORK_*` errors with file context.
4. Document the new scenario in this page's table when it represents a new behavior class.

Next: [Application & lifecycle](../fundamentals/application-lifecycle.md).
