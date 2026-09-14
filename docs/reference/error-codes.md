---
title: Error codes
description: All 14 FRAMEWORK_* codes — meaning, timing, causes, diagnosis, fix.
---

# Error codes

Template per code: **meaning → when → common causes → diagnose → fix → related config.** Full semantics: [Errors](../fundamentals/errors.md).

| Code | Category | Meaning |
|---|---|---|
| `FRAMEWORK_INVALID_CONFIGURATION` | Config | Bootstrap input failed validation (options, names, duplicates, deploy preconditions, loader file errors). Fix the input; check boot logs for file context. |
| `FRAMEWORK_ROUTE_NOT_FOUND` | Validation | No registered handler for the interaction (unknown command/component/modal/autocomplete/menu, `type` mismatch, non-object raw). Logged; dispatch resolves `ok: true, command: ""`. Fix names/deploy. |
| `FRAMEWORK_COMMAND_VALIDATION_FAILED` | Validation | `parseOptions` or `respond` validation failed (missing required, wrong type, range/length, choices, entity shape, >25 autocomplete choices). Fix schema or caller. |
| `FRAMEWORK_COMMAND_HANDLER_FAILED` | Application | Handler (or throwing guard) threw; wrapped with `cause` preserved, recovery reply attempted, `ok: false`. Fix the handler; add regression test. |
| `FRAMEWORK_MIDDLEWARE_FAILED` | Framework | Double `next()` (or chain underflow). Fix the middleware; test ordering. |
| `FRAMEWORK_PLUGIN_INITIALIZATION_FAILED` | Plugin | Unit `setup()` threw; context carries the unit name. Fix setup; check dep order. |
| `FRAMEWORK_LIFECYCLE_HOOK_FAILED` | Framework | Hook threw or illegal transition (attach while running, double start). Fix hook; make starts idempotent-safe. |
| `FRAMEWORK_CONNECTOR_START_FAILED` | Network/Gateway | `connector.start()` (login) failed. Check token, intents, network. |
| `FRAMEWORK_SHARD_OPERATION_FAILED` | Gateway | Shard spawn/eval/fetch failed or timed out; context carries `shardId`. Retry policy is team-owned. |
| `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED` | DiscordAPI | Second ack on one interaction. Ack once, then `followUp`. |
| `FRAMEWORK_SHUTDOWN_TIMEOUT` | Internal | `stop()` exceeded `shutdownTimeoutMs` (dispatches/jobs/connector). Raise the budget or shorten work. |
| `FRAMEWORK_SERVICE_NOT_FOUND` | Internal | `services.get` on an unregistered key. Register first or use `tryGet`. |
| `FRAMEWORK_SERVICE_ALREADY_REGISTERED` | Internal | Double `register`. Guard registration or split keys. |
| `FRAMEWORK_INTERNAL` | Internal | Framework invariant violated (missing reply method, missing autocomplete `respond`, short chain). Report with `formatFrameworkError` output + repro. |

Diagnose with `formatFrameworkError` (code/category/context/cause-chain≤3/diagnostic) and the `requestId` across log lines. Never log tokens while doing so.
