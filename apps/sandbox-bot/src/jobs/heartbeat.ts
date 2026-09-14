import { defineJob } from "@nexum/jobs";

/** Liveness heartbeat: proves the scheduler runs inside bot lifecycle. */
export const heartbeatJob = defineJob({
  name: "heartbeat",
  everyMs: 30_000,
  runOnStart: true,
  timeoutMs: 5_000,
  run: async (ctx) => {
    ctx.logger.info({ event: "heartbeat" }, "heartbeat");
  },
});

export default heartbeatJob;
