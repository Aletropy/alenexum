---
title: Configuration
description: BotOptions fields, validation behavior, and secret handling.
---

# Configuration

```ts
const bot = new Bot({
  token: process.env.DISCORD_TOKEN!,
  shutdownTimeoutMs: 10_000,
});
```

`resolveConfig` validates the input with zod and returns the resolved config (`bot.config`). Any violation throws `FRAMEWORK_INVALID_CONFIGURATION` (category `Config`, event `config.validate`) with a probabilistic diagnostic pointing at the usual suspect (missing `DISCORD_TOKEN`).

See the full per-option table — types, defaults, performance and security implications — in [Configuration reference](../reference/configuration.md). The short version:

- `token` (required): non-empty string. Held for the connector. **Never logged** — the logger redacts `token` paths.
- `shutdownTimeoutMs` (default `10_000`): positive integer deadline for graceful `stop()`.
- `connector`, `logger`, `tracer`, `observer`: structural interfaces (connector = `{ start, stop }`, logger = pino-compatible, tracer = OTel-compatible `startSpan`, observer = `{ observe }`). Mis-shaped values fail validation at construction, not at first use.

Secrets come from the environment only. There is no config-file loader, no `.env` reader in the framework (`dotenv` in the sandbox is app code), and `resolveConfig` never echoes the token — not in messages, not in context, not in logs (verified by `config.test.ts` and `logger.test.ts`).
