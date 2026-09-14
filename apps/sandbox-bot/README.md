# sandbox-bot

Living stress harness for the framework. Exercises the real milestone flow:
boot → discord.js login → REST deploy → interaction routing → middleware →
handler → reply → structured logs.

## Setup

```bash
cp .env.example .env   # then set DISCORD_TOKEN (and GUILD_ID for instant guild deploy)
pnpm --filter sandbox-bot dev
```

## Commands

| Command | Purpose |
|---|---|
| `/ping` | Happy path: replies `Pong!` |
| `/add a b` | Options: required integers, typed `ctx.options` |
| `/echo text [shout]` | Options: required string with bounds + optional boolean |
| `/userinfo target` | Options: required user entity |
| `/vote` | Buttons via escape hatch (`vote:yes`/`vote:no`), prefix routing, `update()` |
| `/color` | String select menu, `ctx.values` |
| `/feedback` | Modal via `showModal()` escape hatch, `ctx.fields` |
| `/search query` | Autocomplete handler with filtered choices |
| `/server` | Guild-only guard demo (`requireGuild`) |
| `/hello [name]` | Module demo: command + service from the greetings module |

> `/echo` has a 10s per-user cooldown — repeat it quickly to see the deny path.
| `/boom` | Failure injection: handler throws → error boundary, structured log, recovery reply |
| `/slow` | Slow op: defers, waits 2s, follows up (try `Ctrl+C` mid-flight for shutdown behavior) |

## Context menus

| Menu | Purpose |
|---|---|
| `Get avatar` (user) | Replies with the target's avatar URL |
| `Quote message` (message) | Replies with a quote of the target message |

## Shutdown

`SIGINT`/`SIGTERM` trigger `bot.stop()` (hooks + connector teardown inside
`shutdownTimeoutMs`) before exiting.
