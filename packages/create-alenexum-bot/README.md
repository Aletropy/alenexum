# create-alenexum-bot

Scaffold a new [alenexum](https://github.com/matrovian/alenexum) Discord bot project.

## Usage

```bash
npm create alenexum-bot@latest [name] [flags]
# or
pnpm create alenexum-bot [name] [flags]
```

Without `--yes`, the CLI walks through an interactive wizard: project name, package manager, Gateway intents preset, command deployment mode, log level, optional features (telemetry, jobs, testing), and an optional Discord bot token — written only to a local `.env` file (mode `0600`), never printed or logged.

### Flags

| Flag | Meaning |
| --- | --- |
| `-y, --yes` | Accept defaults, skip all prompts. |
| `--pm=<npm\|pnpm\|yarn\|bun>` | Package manager for the install step. |
| `--token <token>` | Discord bot token (written to `.env` only). |
| `--no-token` | Skip the token prompt entirely. |
| `--no-install` | Scaffold only; do not run the install step. |
| `--no-git` | Skip git initialization. |
| `-f, --force` | Overwrite a non-empty target directory. |
| `-h, --help` | Show help. |

## Development

```bash
pnpm --filter create-alenexum-bot build
node packages/create-alenexum-bot/dist/index.js my-bot -y --no-install --no-git --no-token
```

Template sources live under `templates/base` (always applied) and `templates/features/{jobs,testing}` (applied when those features are selected). Files are rendered through a small mustache-like engine (`src/render.ts`) — `{{token}}` substitution and `{{#section}}...{{/section}}` conditionals — before being written out.
