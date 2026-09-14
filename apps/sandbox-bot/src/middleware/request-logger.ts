import type { Middleware } from "@nexum/core";

/** Global middleware seed: logs every interaction with its route and requestId. */
export const requestLogger: Middleware = async (ctx, next) => {
  const startedAt = Date.now();
  ctx.logger.debug(
    { event: "interaction.received" },
    `Received "${ctx.route}"`,
  );
  await next();
  ctx.logger.debug(
    { event: "interaction.middlewareDone", durationMs: Date.now() - startedAt },
    `Middleware chain done for "${ctx.route}"`,
  );
};

export default requestLogger;
