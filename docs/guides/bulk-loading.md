---
title: Bulk loading
description: Explicit bootstrap directory loading — sorted, validated, fail-fast, never on the hot path.
---

# Bulk loading

`load*` functions are **explicit bulk registration**: the call site names the directory and the kind. There is no magic discovery, no ambient filesystem access, no hot-path I/O — ever.

```ts
import { loadCommands, loadMiddleware } from "@alenexum/core";

await loadMiddleware(bot, src("middleware"));
await loadCommands(bot, src("commands"));
await loadComponents(bot, src("components"));
await loadModals(bot, src("modals"));
await loadAutocomplete(bot, src("autocomplete"));
await loadContextMenus(bot, src("context-menus"));
await loadGuards(bot, src("guards"));       // when you keep guards in files
await loadPlugins(bot, src("plugins"));
await loadModules(bot, src("modules"));
await loadJobs(scheduler, bot.logger, src("jobs")); // @alenexum/jobs
```

Rules (all enforced):

- Files load in **sorted order**; `recursive`, `pattern`, and `extensions` (`.js/.mjs/.cjs/.ts/.mts/.cts`) customize the scan. Dotfiles, `.d.*`, `.map`, non-matching extensions, and `node_modules` are skipped.
- Each module's default export is validated as `unknown`: a single definition or an array. Malformed modules, missing defaults, duplicates, import throws, and missing directories are fail-fast `FRAMEWORK_INVALID_CONFIGURATION` with **file context** (`loader`, `directory.read`, `{kind}.load`).
- Per-file `debug` logs plus a summary `info` line report outcomes (`LoadReport { dir, loaded: [{ file, kind, key }] }`).
- `register` callbacks return the registered keys, so reports stay accurate for every kind.

When **not** to use loaders: fewer than a handful of definitions (call `bot.command(...)` directly — clearer), or definitions requiring non-trivial construction order (register explicitly so the order is visible).
