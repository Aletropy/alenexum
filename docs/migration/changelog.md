---
title: Changelog
description: How changes are recorded and released.
---

# Changelog

Changes are recorded per release with user-facing impact, grouped as:

```text
Added / Changed / Fixed / Deprecated / Removed / Breaking / Security
```

- Release notes explain **impact on users**, not commit lists. Breaking entries follow the Before → After → Why → Migration steps → Potential issues → Validation template.
- Source of truth for released history: GitHub releases. This page defines the convention; the per-version entries live with the releases so docs and tags cannot drift.
- Current baseline: `0.1.0` — initial public shape (`core`, `discord`, `testing`, `telemetry`, `jobs`, `sharding` real; seven stubs reserved).
