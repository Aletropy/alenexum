---
title: Testing
description: Test commands, middleware, guards, and failures without Discord — the pyramid, fakes, harness, and sandbox.
---

# Testing

Strategy: mostly fast unit + type tests, fewer integration tests, a small E2E set, regression tests for important fixes, and the sandbox as the living stress harness. Tests are deterministic, isolated, async-explicit, and timing-flake resistant (injectable clocks, no wall-time assertions).

## The harness (`@nexum/testing`)

Zero dependencies (intentionally — avoids a core cycle). Two pieces:

**Fakes** — structural interactions satisfying the framework's probes:

```ts
import { chatInputInteraction, buttonInteraction } from "@nexum/testing";

const interaction = chatInputInteraction({ commandName: "add", options: { a: 2, b: 3 } });
```

Factories: `createFakeInteraction`, `chatInputInteraction`, `buttonInteraction`, `selectInteraction`, `modalInteraction`, `autocompleteInteraction`, `contextMenuInteraction`, plus `FakeOptionResolver` (all getters + `getFocused`) and `NonCommandOptions`.

**Dispatch helpers** — drive a real `Bot` through `handleInteraction`:

```ts
import { dispatchChatInput, LogCapture } from "@nexum/testing";

const { result, interaction } = await dispatchChatInput(bot, "add", { a: 2, b: 3 });
expect(result.ok).toBe(true);
expect(interaction.replies).toEqual(["Result: 5"]);
```

Helpers exist for all five kinds (`dispatchChatInput/Button/Modal/Autocomplete/ContextMenu`). `TestBotLike` is the structural contract (`Bot satisfies TestBotLike`, verified by `harness-contract.test.ts`). `LogCapture` (a `Writable`) parses JSON log lines and filters by event name for assertion.

## What to test

| Layer | How | Example |
|---|---|---|
| Command handler | `dispatchChatInput` + fake options | happy path, validation failure (`ok: false`, `COMMAND_VALIDATION_FAILED`) |
| Guard / permission | dispatch with/without guild, roles, ids | denial resolves `ok: true`, observed `denied` |
| Cooldown | `now` injection | allow → deny with seconds → allow after expiry |
| Middleware | real bot + spy middleware | order (global → local), double-`next` throws `MIDDLEWARE_FAILED` |
| Component/modal/autocomplete | `dispatchButton/Modal/Autocomplete` | prefix args, `values`, `fields.get`, `respond` validation |
| Jobs | `JobScheduler` + manual `trigger` | overlap skip, timeout isolation, stop semantics |
| Telemetry | `HealthMonitor` + `MetricRegistry` | fail/timeout/slow checks, counter/histogram snapshots |
| Failure injection | `/boom`-style throwing handlers | wrapped `COMMAND_HANDLER_FAILED`, recovery reply, `cause` preserved |

## Type tests

Option inference is covered by type-level tests (`options-inference.test.ts`): required vs optional, choice literal unions, empty schemas, assignability. Add type tests when changing public signatures.

## The sandbox in the strategy

Unit tests prove logic; the sandbox proves wiring: real login, real REST deploy, real ack deadlines, collectors, concurrency (`/flood`), slow paths (`/slow`, `/timeout`), double-ack (`/dupe`), and shutdown mid-flight. Run it before releases that touch lifecycle, dispatch, replies, or deploy.

## Regression tests

Every important bugfix gets a regression test in the owning package (`packages/core/test`, `packages/discord/test`, `packages/jobs/test`, `packages/telemetry/test`, `packages/sharding/test`, `packages/testing/test`). Never delete or weaken tests to make CI pass.
