# {{projectName}}

A Discord bot built with [alenexum](https://github.com/Aletropy/alenexum), a TypeScript application framework on top of discord.js.

## Setup

1. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` (and `GUILD_ID` if you want instant guild-scoped command deployment).
{{#standardIntents}}2. This project requests the **Message Content** privileged intent. Enable it for your application under the Discord Developer Portal → Bot → Privileged Gateway Intents, or slash commands will still work but message-based features won't.
{{/standardIntents}}3. Install dependencies (if you skipped this during scaffolding): `npm install` (or your package manager of choice).
4. Run in development: `npm run dev`.

## Commands

| Command | Description |
| --- | --- |
| `/ping` | Replies with "Pong!" |

`src/components`, `src/modals`, `src/autocomplete`, and `src/context-menus` ship a small set of adaptable reference examples (see the comments in each file) — wire them into your own commands or delete what you don't need.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run the bot with `tsx`, no build step. |
| `npm run build` | Compile to `dist/` with `tsup` (unbundled — keeps the `src/` directory layout so file-based loading still works in production). |
| `npm start` | Run the compiled bot from `dist/`. |
| `npm run lint` | Check formatting and lint rules with Biome. |
| `npm run typecheck` | Type-check with `tsc --noEmit`. |
{{#testing}}| `npm test` | Run the test suite with Vitest. |
{{/testing}}
{{#jobs}}## Jobs

`src/jobs/heartbeat.ts` is a sample background job (via `@alenexum/jobs`) that logs a heartbeat every 30 seconds — a template for your own scheduled work.

{{/jobs}}{{#telemetry}}## Telemetry

`@alenexum/telemetry` is wired in: dispatch metrics and a health monitor are registered as services (`bot.services.get("metrics")` / `.get("health")`), and Discord client connectivity is checked automatically.

{{/telemetry}}## Environment variables

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | — | Bot token; never commit it. |
| `GUILD_ID` | No | — | Dev guild snowflake for instant `guild`-mode deploy. |
| `DEPLOY_MODE` | No | `guild` if `GUILD_ID` set, else `skip` | `guild` \| `global` \| `skip` |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `NODE_ENV` | No | — | `production` switches to JSON logs. |

## Learn more

See the [alenexum documentation](https://github.com/Aletropy/alenexum) for guides on commands, middleware, plugins, and more.
