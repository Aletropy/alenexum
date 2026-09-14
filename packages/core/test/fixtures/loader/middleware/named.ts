import type { Middleware } from "../../../../src/index.js";

export const requestLogger: Middleware = async (ctx, next) => {
  ctx.logger.debug({ event: "fixture.middleware" }, `saw ${ctx.route}`);
  await next();
};

export default requestLogger;
