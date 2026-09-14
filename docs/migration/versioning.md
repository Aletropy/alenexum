---
title: Versioning
description: Public-API contract, deprecation policy, and breaking-change rules.
---

# Versioning

- **Current:** `0.1.0` (all real packages). Pre-1.0: minor bumps may carry breaking changes, but every breaking change ships with a [changelog entry](./changelog.md), an upgrade guide when mechanical migration is possible, and — where feasible — a deprecated alias for one minor cycle.
- **Contract:** narrow public exports (only `src/index.ts` re-exports are public). Additive changes (new exports, optional fields) are non-breaking. Renames, removals, required-field additions, and semantic changes are breaking.
- **Deprecation:** deprecated APIs log or document `Deprecated since X, use Y, removal in Z`. Removal never lands without a prior deprecation note except for security fixes.
- **Reserved stubs** (`commands`, `events`, `middleware`, `components`, `plugins`, `cli`, `all`) becoming real is **not** breaking (they export nothing today), but their new APIs start under the same contract from introduction.
- **Docs versioning:** the Docusaurus site is structured for `latest` / `vNext` / `vX` versioning when the first stable cut lands; until then, docs track `main` and every behavior page names the package version it describes.
