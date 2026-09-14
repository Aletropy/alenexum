---
title: Troubleshooting
description: Symptom → possible causes → diagnosis → logs → fix → prevention for real failure classes.
---

# Troubleshooting

Each entry follows: **Symptom → Possible causes → How to diagnose → Relevant logs → Fix → Prevention.** Diagnostics stay probabilistic — the framework reports evidence, not certainty.

## Bot fails to start: `FRAMEWORK_INVALID_CONFIGURATION` / `config.validate`

- **Possible causes:** `DISCORD_TOKEN` unset or empty; `shutdownTimeoutMs` not a positive int; mis-shaped `connector`/`logger`/`tracer`/`observer`.
- **Diagnose:** read the error message — it lists `path: reason` pairs. Check `formatFrameworkError(error)`.
- **Logs:** `{ subsystem: "config", event: "config.validate" }`.
- **Fix:** set `DISCORD_TOKEN`; correct the flagged option.
- **Prevention:** validate env at boot (like the sandbox) and fail before constructing anything else.

## Command not found at runtime: `FRAMEWORK_ROUTE_NOT_FOUND`

- **Possible causes:** handler registered under a different name; deploy out of date (`collectDeployBody` ≠ Discord side); slash-name rule violation rejected at registration (check boot logs); component `type` mismatch; autocomplete with no handler.
- **Diagnose:** `bot.getCommandNames()` / `getCommandDefinitions()` at boot; compare with Discord's installed commands. For components, check exact vs `:`-prefix expectations and `ctx.args`.
- **Logs:** route-miss log with `command` + `requestId`; boot-time registration errors with file context when using loaders.
- **Fix:** align names, re-run `deployCommands()` (`guild` mode for instant dev propagation).
- **Prevention:** assert registered names in a boot smoke test; keep deploy mode explicit per environment.

## Option validation fails: `FRAMEWORK_COMMAND_VALIDATION_FAILED`

- **Possible causes:** required option omitted; wrong primitive; min/max or length violation; unknown `choices` value; entity without string `id`.
- **Diagnose:** error context carries `command` + `requestId`; `parseOptions` failures name the option.
- **Fix:** fix the schema (builders) or the caller; for autocomplete partial input, rely on lenient parsing (automatic in autocomplete contexts).
- **Prevention:** type-level tests for inference + dispatch tests with boundary values.

## Handler throws: `FRAMEWORK_COMMAND_HANDLER_FAILED`

- **Possible causes:** application bug (cause preserved); downstream throw (DB, API); double-ack (see below).
- **Diagnose:** `error.cause` chain (capped at 3 in formatted output), `requestId` across logs, `durationMs`.
- **Logs:** dispatch error log with full context; recovery-reply attempt logged.
- **Fix:** fix the handler; add guard validation before expensive work; never swallow — let the boundary wrap.
- **Prevention:** regression test per important fix; failure-injection commands (`/boom`) in staging.

## Double acknowledgment: `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED`

- **Possible causes:** `reply` then `reply`/`update`; `reply` then `deferUpdate`; component handler replying when a collector owns the response; `poll`-style flows acking twice.
- **Diagnose:** reproduce with `/dupe`; trace ack calls per `requestId`.
- **Fix:** ack once, then `followUp` for more output; use quiet `deferUpdate()` when a collector announces results.
- **Prevention:** keep one ack site per handler; prefer `deferReply` first for slow work.

## Interaction times out (no error, user sees "interaction failed")

- **Possible causes:** no ack within ~3 s; `await` before first ack on slow paths.
- **Fix:** `deferReply()` immediately, `followUp()` when done (sandbox `/slow` pattern).
- **Prevention:** audit every handler for "ack first" ordering.

## Shutdown hangs: `FRAMEWORK_SHUTDOWN_TIMEOUT`

- **Possible causes:** in-flight dispatches longer than `shutdownTimeoutMs`; job runs not cooperating with `AbortSignal`; connector `stop()` hanging.
- **Diagnose:** `getActiveDispatchCount()`, `scheduler.getStatus()` (running counts), `/health` before stop.
- **Fix:** raise `shutdownTimeoutMs` deliberately, or shorten work / honor `signal` in jobs.
- **Prevention:** SIGINT/SIGTERM → `bot.stop()` wiring (sandbox pattern); timeout-tested jobs.

## Slow command deployment

- **Possible causes:** `global` mode (up to ~1 h propagation) used for dev iteration.
- **Fix:** `guild` mode with `GUILD_ID` for development; `global` only for releases.
