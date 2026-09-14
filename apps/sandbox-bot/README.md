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
| `/boom` | Failure injection: handler throws → error boundary, structured log, recovery reply |
| `/slow` | Slow op: defers, waits 2s, follows up (try `Ctrl+C` mid-flight for shutdown behavior) |

## Shutdown

`SIGINT`/`SIGTERM` trigger `bot.stop()` (hooks + connector teardown inside
`shutdownTimeoutMs`) before exiting.
