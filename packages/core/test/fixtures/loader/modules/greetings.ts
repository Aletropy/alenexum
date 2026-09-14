import { defineCommand, defineModule } from "../../../../src/index.js";

export default defineModule({
  name: "fixture-module",
  setup: (host) => {
    host.command(
      defineCommand({
        name: "from-module",
        description: "Registered by the fixture module",
        async execute(ctx) {
          await ctx.reply("module");
        },
      }),
    );
  },
});
