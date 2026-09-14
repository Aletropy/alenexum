import type { BaseInteractionContext } from "./context.js";
import { FrameworkError } from "./errors.js";

/**
 * Middleware sees the shared base context (ids, logger, services, escape
 * hatches) across every interaction type. Typed payloads (options, values,
 * fields) are handler-domain and accessed in `execute`, not middleware.
 */
export type Middleware = (
  ctx: BaseInteractionContext,
  next: () => Promise<void>,
) => void | Promise<void>;

export type CommandHandler = (
  ctx: BaseInteractionContext,
) => void | Promise<void>;

/**
 * Compose middleware into an onion chain around the final handler.
 * `C` is pinned explicitly at each dispatch site (never inferred from the
 * handler, whose contravariant parameter would otherwise win). No
 * reflection, no allocation beyond the closure chain.
 */
export function compose<C extends BaseInteractionContext>(
  middlewares: readonly Middleware[],
): (ctx: C, handler: (ctx: C) => void | Promise<void>) => Promise<void> {
  return async (ctx, handler) => {
    let index = -1;
    const dispatch = async (current: number): Promise<void> => {
      if (current <= index) {
        throw new FrameworkError({
          code: "FRAMEWORK_MIDDLEWARE_FAILED",
          category: "Framework",
          message: "next() called more than once in the middleware chain",
          context: {
            subsystem: "middleware",
            event: "middleware.next",
            command: ctx.route,
            requestId: ctx.requestId,
          },
          diagnostic: {
            likelyCause: "A middleware function invoked next() multiple times.",
            suggestedInvestigation: [
              "Audit custom middleware for duplicated or looped next() calls.",
              "Ensure next() is awaited exactly once per middleware invocation.",
            ],
          },
        });
      }
      index = current;
      if (current === middlewares.length) {
        await handler(ctx);
        return;
      }
      const fn = middlewares[current] as Middleware | undefined;
      if (fn === undefined) {
        throw new FrameworkError({
          code: "FRAMEWORK_INTERNAL",
          category: "Internal",
          message: "Middleware chain is shorter than expected",
          context: { subsystem: "middleware", event: "middleware.dispatch" },
        });
      }
      await fn(ctx, () => dispatch(current + 1));
    };
    await dispatch(0);
  };
}
