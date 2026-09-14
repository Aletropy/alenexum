---
title: Contributing
description: Repository structure, standards, and how to change public APIs safely.
---

# Contributing

## Structure

```text
packages/core       # Bot, lifecycle, config, errors, logger, registry, middleware, context, DI-lite
packages/discord    # discord.js adapter + REST deploy
packages/testing    # fakes + harness (dependency-free)
packages/telemetry  # health + metrics (opt-in)
packages/jobs       # scheduler + lifecycle plugin
packages/sharding   # ShardingManager coordination
packages/{commands,events,middleware,components,plugins,cli,all}  # reserved stubs
apps/sandbox-bot    # living stress harness
tooling/            # shared TS config
website/            # Docusaurus site (docs/ lives at repo root)
docs/               # documentation source of truth
```

Dependency direction: `core → features → discord → discord.js`. No cycles (`testing` depends on nothing).

## Setup

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build  # = pnpm ci
```

## Standards

- `strict: true`, no unnecessary `any`; `unknown` + explicit validation at every boundary (Discord, env, files, DBs, queues).
- Composition over inheritance; explicit registration over magic discovery.
- Structured logs with the binding contract; `FRAMEWORK_*` codes for new failure modes with classify-capture-log-recover handling; probabilistic diagnostics only.
- No token/secret logging; no `eval` of untrusted input; no permission bypass without tests.

## Changing public APIs

1. Inspect existing code and reuse primitives + discord.js first (hard rule: do not reimplement discord.js).
2. Keep exports narrow and additive; if breaking is unavoidable: document + migrate + test + consider deprecation (see [Versioning](./migration/versioning.md)).
3. Add/adjust unit + type tests, a regression test for fixes, docs for behavior changes, logging for failure paths, and a perf check for hot-path changes.
4. Update `docs/api/*` in the same PR and keep `pnpm docs:check` green (export coverage + example typecheck + site build).
5. Never delete/weaken tests or types to make CI pass; never hide errors.

## Docs checks

```bash
pnpm docs:check   # export coverage + example typecheck
pnpm docs:build   # Docusaurus production build (broken links throw)
pnpm --filter website start  # local preview
```

Docs-site constraints (do not "fix" these without re-verifying `pnpm docs:build`):

- `website/package.json` must **not** set `"type": "module"`. With ESM package scope, webpack classifies the generated `.docusaurus/registry.js` as strict `javascript/esm`, silently ignores the babel-transformed `require()` calls Docusaurus emits for the server bundle, and SSG crashes with `require.resolveWeak is not a function`. The `.mjs` check script stays ESM by extension.
- `pnpm-workspace.yaml` pins `webpack` to a version verified with the pinned `@docusaurus/*` line. Upgrading either requires a green `pnpm docs:build` on both Node 22 and 26.
- Every public export of the six real packages must be named in `docs/api/*` (`pnpm docs:check` enforces this); stub packages must stay export-free.
