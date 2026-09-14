---
title: Reserved packages
description: Stub packages with no public API — what they are and what to use instead.
---

# Reserved packages

The following packages exist as **empty placeholders** (`private: true`, single `export {}` marked "reserved for a later phase"). They have no exports, no behavior, and no docs pages beyond this one. The export-coverage CI check explicitly ignores them.

| Package | Status | Use instead |
|---|---|---|
| `@nexum/commands` | Reserved stub | `@nexum/core` (`defineCommand`, `CommandRegistry`) |
| `@nexum/events` | Reserved stub | discord.js client events via `ctx.client` escape hatch |
| `@nexum/middleware` | Reserved stub | `@nexum/core` (`compose`, `Middleware`) |
| `@nexum/components` | Reserved stub | `@nexum/core` (`defineComponent`, `CustomIdRegistry`) |
| `@nexum/plugins` | Reserved stub | `@nexum/core` (`definePlugin`) |
| `@nexum/cli` | Reserved stub | No CLI exists; use `load*` + `deployCommands` in app code |
| `@nexum/all` | Reserved stub | Import per-package directly |

If a stub gains a real implementation, this page shrinks and a dedicated API page appears with migration notes — never silently.
