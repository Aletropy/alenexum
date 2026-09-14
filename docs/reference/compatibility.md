---
title: Compatibility
description: Supported runtimes and dependency matrix.
---

# Compatibility

| Dependency | Required | Notes |
|---|---|---|
| Node.js | `>= 22` | `engines` + CI matrix (22, 26). |
| pnpm | `>= 10` | Workspaces; lockfile committed. |
| TypeScript | `~5.9.3`, `strict: true` | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `useUnknownInCatchVariables`. |
| discord.js | `^14.18.0` | Used by `@nexum/discord`, sandbox, `@nexum/sharding`. Core never depends on it. |
| zod | `^4.1.5` | `@nexum/core` (config) and `@nexum/sharding` (shard options). |
| pino / pino-pretty | `^9.6.0` / `^13.0.0` | `@nexum/core` logger backend. |
| vitest / tsup / turbo / biome | repo-pinned | Test, build, orchestrate, lint. |
| Docusaurus | `^3.8.0` (website only) | Docs site; not a runtime dependency. |

Type declarations ship per package (`dist/index.d.ts` via tsup). `skipLibCheck: true` in the base config; public types favor `unknown` + runtime validation at boundaries.
