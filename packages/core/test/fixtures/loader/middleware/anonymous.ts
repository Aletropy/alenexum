import type { Middleware } from "../../../../src/index.js";

export default (async (_ctx, next) => {
  await next();
}) as Middleware;
