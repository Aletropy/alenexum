---
title: "ADR 001: Framework boundary"
description: Why Alenexum composes discord.js instead of reimplementing it.
---

# ADR 001: Framework boundary

- **Status:** Accepted
- **Context:** Discord bots need both network infrastructure (Gateway, REST, rate limits, caches) and application architecture (lifecycle, routing, DI, observability). Building both invites duplication and drift from Discord API changes.
- **Decision:** discord.js / `@discordjs/*` own all network infrastructure. Alenexum owns application architecture only, integrated through thin seams (`Connector`, `observer`, `tracer`, escape hatches).
- **Alternatives considered:** (a) full-stack framework with own Gateway/REST — rejected: duplicates discord.js, splits rate-limit truth; (b) pure utility library with no lifecycle — rejected: leaves every app to reinvent routing/shutdown/diagnostics.
- **Consequences:** Apps depend on discord.js directly and can use any discord.js feature immediately via escape hatches. Alenexum must never shadow discord.js semantics; new framework features require a "why not discord.js?" justification.
