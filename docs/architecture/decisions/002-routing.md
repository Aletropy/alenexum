---
title: "ADR 002: Command routing"
description: Why dispatch uses bootstrap-built Map registries with prefix-matched customIds.
---

# ADR 002: Command routing

- **Status:** Accepted
- **Context:** Interaction dispatch is the hottest path: every button press, select, modal, autocomplete keystroke, and slash invocation flows through it. Per-request cost must stay flat at high event volume.
- **Decision:** All routing resolves through registries built at bootstrap (`CommandRegistry`, `CustomIdRegistry`, `AutocompleteRegistry`, `ContextMenuRegistry`) with `Map.get` lookups. `customId` families share one definition via longest `:`-prefix probing (`vote` serves `vote:yes` with `args`). Guard arrays are normalized once at registration. No filesystem, reflection, or linear scans on the hot path.
- **Alternatives considered:** (a) per-request pattern matching over all definitions — rejected: O(n) per interaction; (b) decorator/reflect-metadata routing — rejected: reflection cost + magic registration conflicts with explicit `load*` philosophy.
- **Consequences:** Registration validates eagerly (duplicates, bad names fail fast with `FRAMEWORK_INVALID_CONFIGURATION`). Dynamic per-request routing (e.g. DB-driven commands) must rebuild or layer above the registries explicitly — the framework will not scan for you.
