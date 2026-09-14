/**
 * Hot-path benchmarks: registry lookup, customId resolution, option parsing,
 * and middleware composition. Run with `pnpm bench` (core package). These are
 * informational — compare against your own baseline before/after hot-path
 * changes; they do not gate CI.
 */

import { FakeOptionResolver } from "@alenexum/testing";
import { bench, describe } from "vitest";
import { createCommandContext } from "../src/context.js";
import {
  CommandRegistry,
  CustomIdRegistry,
  compose,
  integerOption,
  parseOptions,
  stringOption,
} from "../src/index.js";
import { createLogger } from "../src/logger.js";
import { ServiceContainer } from "../src/services.js";

const logger = createLogger({ level: "silent" });
const services = new ServiceContainer();

const registry = new CommandRegistry();
for (let index = 0; index < 500; index++) {
  registry.register({
    name: `cmd-${index}`,
    description: "bench",
    execute: () => {},
  });
}

const customIds = new CustomIdRegistry<{
  customId: string;
  execute: () => void;
}>();
const noop = () => {};
customIds.registerCustomId(
  { customId: "vote", execute: noop },
  {
    kind: "component",
    registerEvent: "component.register",
    registerCall: "bot.component()",
  },
);

const schema = {
  count: integerOption({
    description: "i",
    required: true,
    minValue: 1,
    maxValue: 100,
  }),
  name: stringOption({ description: "s" }),
};
const resolver = new FakeOptionResolver({ count: 42, name: "bench" });
const interactionWithOptions = { options: resolver };

const composed = compose([
  async (_ctx, next) => next(),
  async (_ctx, next) => next(),
  async (_ctx, next) => next(),
]);
const benchCtx = createCommandContext({
  interaction: { commandName: "ping", reply: async () => {} },
  logger,
  services,
  requestId: "bench",
});

describe("router", () => {
  bench("CommandRegistry.get (500 registered)", () => {
    registry.get("cmd-499");
  });

  bench("CustomIdRegistry.resolve exact", () => {
    customIds.resolve("vote");
  });

  bench("CustomIdRegistry.resolve 3-segment prefix", () => {
    customIds.resolve("vote:yes:user-123");
  });

  bench("parseOptions (2-option schema)", () => {
    parseOptions(interactionWithOptions, schema, {
      command: "bench",
      requestId: "bench",
    });
  });

  bench("compose 3-middleware chain", async () => {
    await composed(benchCtx, () => {});
  });
});
