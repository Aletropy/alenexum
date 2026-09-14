import type { Middleware } from "@discord-framework/core";

/** Global middleware seed: logs receipt of every command with its requestId. */
export const requestLogger: Middleware = async (ctx, next) => {
  const startedAt = Date.now();
  ctx.logger.debug(
    { event: "command.received" },
    `Received command "${ctx.commandName}"`,
  );
  await next();
  ctx.logger.debug(
    { event: "command.middlewareDone", durationMs: Date.now() - startedAt },
    `Middleware chain done for "${ctx.commandName}"`,
  );
};
