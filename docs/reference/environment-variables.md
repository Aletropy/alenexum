---
title: Environment variables
description: Sandbox env contract — the only env surface the repo defines.
---

# Environment variables

The framework itself reads **no** environment variables — `token` and options are passed explicitly. The only env contract in the repo is the sandbox's (`apps/sandbox-bot/.env.example`):

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `DISCORD_TOKEN` | Yes (sandbox) | — | Bot token. Copy `.env.example` → `.env`; never commit. |
| `GUILD_ID` | No | — | Dev guild for instant `guild` deploy. Empty → `skip` mode. |
| `DEPLOY_MODE` | No | `guild` if `GUILD_ID` set, else `skip` | `guild` \| `global` \| `skip`. |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error`. |
| `NODE_ENV` | No | — | `production` switches the sandbox logger to JSON (`pretty: false`). |

Application env handling is app code (`dotenv` in the sandbox is a dependency of the app, not the framework).
