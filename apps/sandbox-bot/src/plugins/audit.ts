import { defineGuard, definePlugin } from "@nexum/core";

/** Cross-cutting plugin: observes every dispatch without owning features. */
export const auditPlugin = definePlugin({
  name: "audit",
  setup: (host) => {
    host.guard(
      defineGuard({
        name: "audit",
        check: (ctx) => {
          host.logger.debug(
            {
              event: "audit.route",
              route: ctx.route,
              requestId: ctx.requestId,
            },
            `Audit: ${ctx.route}`,
          );
          return true;
        },
      }),
    );
  },
});

export default auditPlugin;
