import type { BaseInteractionContext } from "./context.js";
import { FrameworkError } from "./errors.js";

/**
 * Guards: allow/deny gates that run after all middleware and before the
 * handler. A deny is an expected control-flow outcome (not a failure): the
 * user gets a message, the deny is logged, and dispatch returns ok.
 * A guard that *throws* is an application bug and fails dispatch.
 */
export interface GuardResult {
  readonly allowed: boolean;
  readonly message?: string | undefined;
}

export type GuardCheck = (
  ctx: BaseInteractionContext,
) => boolean | GuardResult | Promise<boolean | GuardResult>;

export interface GuardObject {
  readonly name: string;
  readonly check: GuardCheck;
}

/** A guard object or a bare check function (named after the function). */
export type Guard = GuardObject | GuardCheck;

export interface NormalizedGuard {
  readonly name: string;
  readonly check: GuardCheck;
}

export function defineGuard<const T extends GuardObject>(guard: T): T {
  return guard;
}

/** Normalize once at registration (never on the hot path). */
export function normalizeGuard(
  guard: Guard,
  registerCall: string,
): NormalizedGuard {
  if (typeof guard === "function") {
    return { name: guard.name || "anonymous", check: guard };
  }
  if (typeof guard === "object" && guard !== null) {
    if (typeof guard.name !== "string" || guard.name.length === 0) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `${registerCall}: guard objects require a non-empty name`,
        context: { subsystem: "guards", event: "guard.register" },
      });
    }
    if (typeof guard.check !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `${registerCall}: guard "${guard.name}" requires a check() function`,
        context: { subsystem: "guards", event: "guard.register" },
      });
    }
    return { name: guard.name, check: guard.check };
  }
  throw new FrameworkError({
    code: "FRAMEWORK_INVALID_CONFIGURATION",
    category: "Config",
    message: `${registerCall}: guard must be a check function or a { name, check } object`,
    context: { subsystem: "guards", event: "guard.register" },
  });
}

export interface GuardDecision {
  readonly allowed: boolean;
  readonly guard: string;
  readonly message: string | undefined;
}

/** Run guards in order; first deny wins. Throwing checks propagate as bugs. */
export async function runGuards(
  guards: readonly NormalizedGuard[],
  ctx: BaseInteractionContext,
): Promise<GuardDecision> {
  for (const guard of guards) {
    const result = await guard.check(ctx);
    if (result === true) {
      continue;
    }
    if (result === false) {
      return { allowed: false, guard: guard.name, message: undefined };
    }
    if (
      typeof result === "object" &&
      result !== null &&
      typeof result.allowed === "boolean"
    ) {
      if (result.allowed) {
        continue;
      }
      return { allowed: false, guard: guard.name, message: result.message };
    }
    throw new Error(
      `Guard "${guard.name}" returned an invalid result (expected boolean or { allowed, message })`,
    );
  }
  return { allowed: true, guard: "", message: undefined };
}

/** Default user-facing deny text when a guard supplies no message. */
export const DEFAULT_DENY_MESSAGE = "You don't have permission to use this.";
