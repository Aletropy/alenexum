---
title: Errors
description: FrameworkError, stable codes, categories, diagnostics, and the Detect-Classify-Capture-Log-Recover pipeline.
---

# Errors

Every framework failure is a `FrameworkError`: a stable machine-readable `code` (`FRAMEWORK_*`), a `category`, contextual metadata, an optional actionable `diagnostic`, and a preserved `cause` chain.

```ts
import { FrameworkError, isFrameworkError, formatFrameworkError } from "@nexum/core";

try {
  await bot.start();
} catch (error) {
  if (isFrameworkError(error)) {
    console.error(formatFrameworkError(error)); // code/category/context/cause-chain/diagnostic
  }
  throw error;
}
```

## Codes and categories

14 stable codes (`FRAMEWORK_ERROR_CODES`): `INVALID_CONFIGURATION`, `ROUTE_NOT_FOUND`, `COMMAND_VALIDATION_FAILED`, `COMMAND_HANDLER_FAILED`, `MIDDLEWARE_FAILED`, `PLUGIN_INITIALIZATION_FAILED`, `LIFECYCLE_HOOK_FAILED`, `CONNECTOR_START_FAILED`, `SHARD_OPERATION_FAILED`, `INTERACTION_ALREADY_ACKNOWLEDGED`, `SHUTDOWN_TIMEOUT`, `SERVICE_NOT_FOUND`, `SERVICE_ALREADY_REGISTERED`, `INTERNAL`.

Categories: `Config`, `Validation`, `UserInput`, `Permission`, `Application`, `Framework`, `DiscordAPI`, `RateLimit`, `Gateway`, `Network`, `Database`, `Plugin`, `Dependency`, `Internal`, `Unknown`. The category tells you who owns the fix: `Config` = operator input, `Validation` = bad shape at the boundary, `DiscordAPI` = ack/transport semantics, `Application` = your handler threw (wrapped, cause preserved).

Per-code meaning, causes, diagnosis, and fixes: [Error codes](../reference/error-codes.md).

## Pipeline

`Detect → Classify → Capture context → Log → Safe recovery → Actionable diagnostic.` Concretely: the dispatch boundary detects the throw, classifies it (framework code or `toFrameworkError` wrap of an app error), captures `{ subsystem, event, command, interactionId, guildId, channelId, userId, shardId, requestId, plugin/module, durationMs }`, logs through the framework logger, attempts a safe recovery reply, and attaches a diagnostic.

Diagnostics are probabilistic by contract — `likelyCause` plus `suggestedInvestigation[]`, never false certainty ("Possible cause / Suggested actions").

Helpers: `isFrameworkError(e)`, `toFrameworkError(code, category, message, err, ctx, diag)` (passes framework errors through, appends app messages, preserves `cause`), `serializeError(e)` (JSON-safe, no secrets), `formatFrameworkError(e)` (human-readable, cause chain capped at 3).

Related: [Error codes](../reference/error-codes.md) · [Troubleshooting](../guides/troubleshooting.md).
