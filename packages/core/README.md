# `@discord-framework/core`

Application architecture for Discord bots. No discord.js dependency — the
transport is injected via the `Connector` interface (implemented by
`@discord-framework/discord`).

## API

```ts
import { Bot, defineCommand, createLogger } from "@discord-framework/core";

const bot = new Bot({ token: process.env.DISCORD_TOKEN! });

bot.use(async (ctx, next) => {
  ctx.logger.debug({ event: "command.received" }, "incoming");
  await next();
});

bot.command(
  defineCommand({
    name: "ping",
    description: "Replies with Pong!",
    async execute(ctx) {
      ctx.services.get<string>("greeting"); // DI-lite
      await ctx.reply("Pong!");
    },
  }),
);

bot.on("afterStart", () => console.log("ready"));
await bot.start(); // lifecycle: beforeStart → connector.start → afterStart
await bot.stop();  // graceful shutdown within shutdownTimeoutMs
```

## Command options

Options are declared with builders and flow into the handler type — required
vs optional, choice literals, and entity shapes are all inferred:

```ts
import { defineCommand, integerOption, stringOption, userOption } from "@discord-framework/core";

const ban = defineCommand({
  name: "ban",
  description: "Ban a user",
  options: {
    target: userOption({ description: "User to ban", required: true }),
    reason: stringOption({ description: "Reason" }),
    severity: integerOption({
      description: "Severity",
      choices: [
        { name: "Low", value: 1 },
        { name: "High", value: 2 },
      ],
    }),
  },
  async execute(ctx) {
    ctx.options.target.id; // ResolvedUser (required)
    ctx.options.reason; // string | undefined
    ctx.options.severity; // 1 | 2 | undefined
  },
});
```

At dispatch, values are parsed and validated against the schema (presence,
types, choices, min/max) before the handler runs. Malformed payloads fail
with `FRAMEWORK_COMMAND_VALIDATION_FAILED` instead of a downstream
`TypeError`. All nine Discord option types are supported
(string/integer/number/boolean/user/channel/role/mentionable/attachment).

## Interactions

Every Discord interaction type routes through `bot.handleInteraction`:

```ts
bot.component(
  defineComponent({
    customId: "vote", // exact match, plus "vote:<args...>" by prefix
    type: "button",
    async execute(ctx) {
      ctx.args; // ["yes"] for customId "vote:yes"
      await ctx.update("counted");
    },
  }),
);

bot.modal(
  defineModal({
    customId: "feedback",
    async execute(ctx) {
      ctx.fields.get("message"); // submitted text input
      await ctx.reply("Thanks!");
    },
  }),
);

bot.autocomplete(
  defineAutocomplete({
    command: "search",
    option: "query", // omit for a command-level fallback
    async execute(ctx) {
      ctx.focused; // { name, value } being typed
      ctx.options; // partial input parsed leniently
      await ctx.respond([{ name: "apple", value: "apple" }]);
    },
  }),
);

bot.contextMenu(
  defineContextMenu({
    type: "user", // or "message"; names may contain spaces/capitals
    name: "Get avatar",
    async execute(ctx) {
      ctx.targetId; // snowflake; raw target via ctx.targetUser
      await ctx.reply("…");
    },
  }),
);
```

Select-menu values arrive as `ctx.values`. Autocomplete handlers that stay
silent get an automatic `[]` response. Missing routes fail with
`FRAMEWORK_ROUTE_NOT_FOUND` naming the registration call to check.

## Composition

Guards run after middleware and before the handler. A deny replies
gracefully (no error); a throwing guard is a bug and fails dispatch.

```ts
import {
  cooldown,
  defineGuard,
  requireGuild,
  requireUserPermissions,
} from "@discord-framework/core";
import { PermissionFlagsBits } from "discord.js";

bot.guard(defineGuard({ name: "audit", check: (ctx) => true })); // global

bot.command(
  defineCommand({
    name: "ban",
    description: "Ban",
    guards: [
      requireGuild(),
      requireUserPermissions(PermissionFlagsBits.BanMembers),
      cooldown({ durationMs: 5_000 }), // per-user, in-memory by default
    ],
    async execute(ctx) {
      /* ... */
    },
  }),
);
```

Available guard factories: `requireGuild`, `requireUserPermissions`,
`requireBotPermissions`, `requireRoles`, `requireUserIds`, `cooldown`
(scope `user`/`channel`/`guild`/`global`, swappable `CooldownStore`).
All permission checks are fail-closed.

## Plugins, modules, services

```ts
import { defineModule, definePlugin } from "@discord-framework/core";

await bot.plugin(
  definePlugin({
    name: "audit",
    setup: (host) => {
      host.use(loggingMiddleware); // or guard/component/…
    },
  }),
);

await bot.module(
  defineModule({
    name: "greetings",
    dependencies: ["db"], // must be registered first; validated
    setup: (host) => {
      host.services.register("greeter", makeGreeter());
      host.command(helloCommand);
    },
  }),
);

// In a handler:
const greeter = ctx.services.get<Greeter>("greeter");
ctx.services.tryGet<Metrics>("metrics"); // optional integration
```

Plugins (cross-cutting: middleware, guards, transports) and modules
(features: commands + services) share one namespace with dependency
validation. Units receive the full registration surface with a tagged
logger (`plugin`/`module` bindings). Use `defaultMemberPermissions` on a
command for Discord client-side gating; runtime enforcement stays in
guards.

## Notes

- Registration validates eagerly (`bot.command` throws on duplicates/bad
  names); dispatch is a `Map.get` plus the middleware chain.
- `handleInteraction` never throws — failures are logged with
  `command/interactionId/guildId/channelId/userId/requestId/durationMs` and
  returned as `{ ok: false, error }`.
- Errors are `FrameworkError`s with stable `FRAMEWORK_*` codes, categories,
  and probabilistic diagnostics (`likelyCause` + `suggestedInvestigation`).
- Tokens and auth headers are redacted from logs.
- `ctx.interaction` / `ctx.client` are escape hatches to raw discord.js objects.
