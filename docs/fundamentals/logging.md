---
title: Logging
description: Structured pino logging, binding contract, child loggers, and secret redaction.
---

# Logging

Logging is structured and mandatory on failure paths: `createLogger` wraps pino (JSON by default, `pino-pretty` when `pretty: true`). Every log line should carry the binding contract:

```text
timestamp, level, subsystem, event, command, guildId, channelId,
userId, shardId, requestId, durationMs, error{name,message,stack,code}
```

`requestId` is minted per dispatch and propagated into the context logger, error context, and observations — including across the jobs scheduler where practical.

## Usage

```ts
import { createLogger } from "@alenexum/core";

const logger = createLogger({ level: "info", pretty: process.env.NODE_ENV !== "production" });
const bot = new Bot({ token, logger });

bot.logger.info({ subsystem: "app", event: "app.ready" }, "Bot ready");

// per-dispatch loggers are pre-bound; prefer ctx.logger inside handlers:
async execute(ctx) {
  ctx.logger.info({ subsystem: "mod", event: "ban.issued" }, "Ban issued");
}
```

`createLogger({ level, pretty, name, destination })`: `destination` is a pino destination seam used by tests (`LogCapture` in `@alenexum/testing` parses the JSON lines). `logger.child(bindings)` merges bindings — contexts, units (`plugin`/`module`), and `shardLogger(shardId)` all build on it.

## Redaction

`redact.paths` covers `token`, `*.token`, `authorization` headers and their variants, and `err.token` / `error.token` — all rendered `[REDACTED]`. Never add tokens, auth headers, or credentials to log bindings; the redaction is a safety net, not a license.

Never `console.error`-only: failure paths log through the framework logger with subsystem + event + error serialization (`serializeError` is JSON-safe and secret-free).

Related: [Errors](./errors.md) · [Health & metrics](../guides/health-metrics.md) · [Troubleshooting](../guides/troubleshooting.md).
