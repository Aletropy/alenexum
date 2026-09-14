---
slug: /intro
title: Introduction
description: What Nexum is, why it exists, and where it sits between your application, discord.js, and Discord.
---

# Introduction

**Nexum is an application framework for Discord bots, from small projects to enterprise-scale systems.**

It organizes and accelerates Discord application development. It is not a network library.

## The stack

```text
Application
     ↓
Nexum (this framework)
     ↓
discord.js / @discordjs/*
     ↓
Discord
```

| Layer | Owns | Examples |
|---|---|---|
| Discord | API, Gateway, voice, rate-limit truth | Interaction payloads, 3-second ack deadline |
| discord.js | Network infrastructure | `Client`, Gateway, REST, caches, builders, collectors, `ShardingManager` |
| Nexum | Application architecture | Lifecycle, routing, middleware, guards, registries, modules, plugins, DI-lite, config, logging, diagnostics, testing |
| Your application | Domain behavior | Commands, workflows, services, jobs, deployment |

## What belongs to Nexum vs discord.js

**Nexum owns:** `Bot` lifecycle (`start`/`stop`, hooks, graceful shutdown), interaction routing and dispatch (`handleInteraction`), the middleware onion (`compose`), allow/deny gates (`Guard`), slash-option schemas and parsing (`parseOptions`), `customId` prefix routing, module/plugin registration with a shared name namespace, `ServiceContainer`, zod-validated `BotOptions`, pino-based structured logging with secret redaction, stable `FRAMEWORK_*` errors with probabilistic diagnostics, optional tracer/observer seams, explicit bootstrap loaders (`loadCommands`, …), and test fakes (`@nexum/testing`).

**discord.js owns:** Gateway connections, REST transport, rate limits, WebSocket reconnects, caches and managers, slash-command builders, collectors, sharding primitives. Nexum never reimplements these — it composes them. `@nexum/discord` is a thin adapter (`createDiscordConnector`) over `Client` + `REST`.

**Escape hatches are first-class.** Every context exposes the raw interaction (`ctx.interaction`) and client (`ctx.client`). If Nexum has no wrapper for something discord.js can do, use discord.js directly — you never wait for a framework release. See [Context](./fundamentals/context.md).

## Why use Nexum

- **Small bots stay small.** One `Bot`, a few `bot.command(...)` calls, `bot.start()`. No Redis, queues, or workers required — those stay optional forever.
- **Growing bots get structure.** Feature modules, cross-cutting plugins, services, middleware, and explicit bulk loading — without magic discovery.
- **Large bots get operability.** Structured logs, health checks, dispatch metrics, background jobs with lifecycle binding, and sharding coordination over discord.js primitives.
- **Everything is testable.** `@nexum/testing` provides fake interactions and a dispatch harness so commands are unit-tested without a Discord connection.

## What Nexum does not do

- Does not replace discord.js or reimplement the Discord API.
- Does not provide a database, cache, queue, or distributed runtime. Those are application/infrastructure choices at the boundary (see [Limitations](./architecture/limitations.md)).
- Does not make distributed systems mandatory. Sharding support coordinates discord.js `ShardingManager`; it does not orchestrate your infrastructure.

## How to read these docs

- **New here?** Start with [Getting Started](./getting-started/first-bot.md), then [Fundamentals](./fundamentals/application-lifecycle.md).
- **Doing a task?** Jump to [Guides](./guides/deploy-commands.md) (how-to, one task per page).
- **Scaling?** Read [Architecture](./architecture/small-app.md) through [Enterprise Boundaries](./architecture/enterprise-boundaries.md).
- **Looking up an API?** Go straight to [API Reference](./api/core.md) or [Error Codes](./reference/error-codes.md).

Next: [Installation](./getting-started/installation.md).
