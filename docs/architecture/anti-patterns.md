---
title: Anti-patterns
description: Common mistakes that fight the framework's architecture — and what to do instead.
---

# Anti-patterns

Only patterns that genuinely conflict with this architecture are listed.

| Anti-pattern | Why it hurts | Do instead |
|---|---|---|
| Everything in one command | untestable, unreusable, Discord-coupled | modules + services; handlers translate and delegate |
| Business logic in interactions | cannot test without Discord; locks domain to Discord shapes | services take/return plain data; test via harness |
| Global mutable state | races across dispatches; breaks shutdown accounting | `ServiceContainer` entries with explicit lifecycle |
| Blocking the event loop | blows the ~3 s ack deadline for every concurrent interaction | defer first; move heavy work to jobs or infrastructure |
| Ignoring ack deadlines | silent "interaction failed" for users | `reply`/`deferReply`/`update`/`deferUpdate` first, `followUp` after |
| Logging secrets | tokens in aggregators; redaction is a net, not a plan | env-only secrets; never bind credentials |
| Unbounded collectors | leaked listeners, memory growth | timeouts + filters + explicit stop (sandbox `/poll`: 15 s, first-vote-wins) |
| Overusing middleware | ordering puzzles; double-`next` faults | guards for allow/deny, middleware for around-behavior, few globals |
| Overengineering small bots | modules/plugins/jobs for 3 commands | [Small apps](./small-app.md); evolve on signal |
| Premature distribution | shards/queues without pressure | [Evolution](./evolution.md); single process until measured |
| Discord-coupled domain | cannot reuse logic outside Discord | ports behind service keys; discord.js only at the edge |
