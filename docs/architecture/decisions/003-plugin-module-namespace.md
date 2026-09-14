---
title: "ADR 003: Plugin and module namespace"
description: Why plugins and modules share one name namespace with order-enforced dependencies.
---

# ADR 003: Plugin and module namespace

- **Status:** Accepted
- **Context:** Modules (features) and plugins (cross-cutting) install into the same host (`command`, `use`, `guard`, `services`). Without coordination, two units can claim the same name or initialize in an order that silently breaks dependents.
- **Decision:** One shared unit namespace (`claimUnitName` throws `FRAMEWORK_INVALID_CONFIGURATION` on duplicates across both kinds) and order-enforced dependencies (`assertUnitDependencies` throws unless deps registered first). Setup failures throw `FRAMEWORK_PLUGIN_INITIALIZATION_FAILED` with unit context; the host logger tags every setup line with the unit name.
- **Alternatives considered:** (a) separate namespaces — rejected: a module and plugin installing the same command would still collide downstream; (b) auto-topological ordering — rejected: hides initialization order, conflicts with explicit `load*` sorted-order philosophy.
- **Consequences:** Units declare `dependencies` honestly and registrars order `await bot.plugin(...)` / `await bot.module(...)` calls visibly. Renames across the shared namespace are breaking changes and follow [Versioning](../../migration/versioning.md).
