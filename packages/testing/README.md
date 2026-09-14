# `@alenexum/testing`

Fakes and integration harness for testing bots. No network, no tokens, deterministic.

## Pyramid

| Layer | Where | What |
|---|---|---|
| Unit + type | `packages/*/test/*.test.ts`, colocated | Fast, isolated, async-explicit. Type inference via `expectTypeOf` (checked by `tsc --noEmit`). |
| Integration | Same suites, through `Bot.handleInteraction` or this harness | Full dispatch: routing → middleware → guards → handler → reply → logs. |
| E2E (live) | `apps/sandbox-bot` | Real Discord connection, manual. Failure-injection commands (`/boom`, `/dupe`, `/flood`, `/timeout`). |
| Benchmark | `packages/core/bench/*.bench.ts` | `pnpm bench`. Informational — compare against your baseline; never gates CI. |

## Harness

```ts
import { createTestBot, dispatchChatInput } from "@alenexum/testing";

const { bot, logs } = createTestBot();
bot.command(pingCommand);

const { result, interaction } = await dispatchChatInput(bot, "ping", {
  optionValues: { text: "hi" },
});
expect(result).toMatchObject({ ok: true });
expect(interaction.replies).toEqual(["Pong!"]);
expect(logs.events("command.execute")).toHaveLength(1);
```

Helpers exist per interaction kind: `dispatchChatInput`, `dispatchButton`,
`dispatchModal`, `dispatchAutocomplete`, `dispatchContextMenu`, plus raw
factories (`chatInputInteraction`, `buttonInteraction`, `selectInteraction`,
`modalInteraction`, `autocompleteInteraction`, `contextMenuInteraction`,
`createFakeInteraction`) and `LogCapture` for structured-log assertions.

## Conventions

- Deterministic: no wall-clock sleeps (inject `now`), no random ports, no real timers except tiny bounded timeouts (e.g. shutdown tests).
- Failure paths first-class: every registry miss, validation error, double-ack, timeout, and recovery branch has a test.
- **Regression policy: every important bugfix ships with a regression test** that fails without the fix and names the failure mode. Keep them next to the behavior they protect; use `*.denied`, double-ack, and drift cases as models.
- Never delete or weaken tests to make CI pass. Fix the code or fix the test's understanding — loudly, in the commit message.
