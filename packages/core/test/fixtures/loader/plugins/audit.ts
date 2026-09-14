import { defineCommand, definePlugin } from "../../../../src/index.js";

export default definePlugin({
  name: "fixture-plugin",
  setup: (host) => {
    host.command(
      defineCommand({
        name: "from-plugin",
        description: "Registered by the fixture plugin",
        async execute(ctx) {
          await ctx.reply("plugin");
        },
      }),
    );
  },
});
