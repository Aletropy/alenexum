import type { BaseInteractionContext } from "./context.js";
import { FrameworkError } from "./errors.js";
import { defineGuard, type GuardObject } from "./guards.js";

/**
 * Cooldowns: per-scope rate limiting implemented as a guard, so denies reuse
 * the standard graceful path (message + log, no error). State lives in a
 * `CooldownStore` — in-memory by default, swappable for a distributed store
 * without touching call sites.
 */
export interface CooldownStore {
  get(key: string): number | undefined;
  set(key: string, expiresAtMs: number): void;
}

export type CooldownScope = "user" | "channel" | "guild" | "global";

export interface CooldownOptions {
  /** Cooldown length per key, must be a finite positive number. */
  readonly durationMs: number;
  /** Defaults to `user`. Missing scope ids fall back to a shared bucket. */
  readonly scope?: CooldownScope | undefined;
  /** Extra namespace; defaults to the route key so one instance is safely reusable. */
  readonly key?: string | undefined;
  readonly message?: string | ((secondsLeft: number) => string) | undefined;
  readonly store?: CooldownStore | undefined;
  /** Testing seam for deterministic time. */
  readonly now?: (() => number) | undefined;
}

/** Single-process store with lazy expiry and a bounded size. */
export class MemoryCooldownStore implements CooldownStore {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly maxEntries = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): number | undefined {
    const expiresAt = this.entries.get(key);
    if (expiresAt === undefined) {
      return undefined;
    }
    if (expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return expiresAt;
  }

  set(key: string, expiresAtMs: number): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
    // Re-insert to refresh recency.
    this.entries.delete(key);
    this.entries.set(key, expiresAtMs);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

export function cooldown(options: CooldownOptions): GuardObject {
  if (
    typeof options.durationMs !== "number" ||
    !Number.isFinite(options.durationMs) ||
    options.durationMs <= 0
  ) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `cooldown() requires a finite positive durationMs, got ${String(options.durationMs)}`,
      context: { subsystem: "cooldowns", event: "cooldown.configure" },
    });
  }
  const scope: CooldownScope = options.scope ?? "user";
  const now = options.now ?? Date.now;
  // The default store shares the guard clock so injected time stays coherent;
  // a caller-supplied store governs its own expiry comparisons.
  const store = options.store ?? new MemoryCooldownStore(10_000, now);
  return defineGuard({
    name: "cooldown",
    check: (ctx) => {
      const scopeId =
        scope === "global" ? "global" : (scopeValue(ctx, scope) ?? "global");
      const key = `${options.key ?? ctx.route}:${scope}:${scopeId}`;
      const at = now();
      const expiresAt = store.get(key);
      if (expiresAt !== undefined && expiresAt > at) {
        const secondsLeft = Math.max(1, Math.ceil((expiresAt - at) / 1000));
        const message =
          typeof options.message === "function"
            ? options.message(secondsLeft)
            : (options.message ?? `Slow down — try again in ${secondsLeft}s.`);
        return { allowed: false, message };
      }
      store.set(key, at + options.durationMs);
      return true;
    },
  });
}

function scopeValue(
  ctx: BaseInteractionContext,
  scope: CooldownScope,
): string | undefined {
  switch (scope) {
    case "user":
      return ctx.userId;
    case "channel":
      return ctx.channelId ?? undefined;
    case "guild":
      return ctx.guildId ?? undefined;
    case "global":
      return "global";
  }
}
