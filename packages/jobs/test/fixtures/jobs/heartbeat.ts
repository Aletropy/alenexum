import { defineJob } from "../../../src/index.js";

export const heartbeatJob = defineJob({
  name: "heartbeat",
  everyMs: 30_000,
  runOnStart: true,
  async run(ctx) {
    ctx.logger.debug({ event: "heartbeat" }, "heartbeat");
  },
});

export default heartbeatJob;
