import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.js";

class MemoryStream extends Writable {
  lines: string[] = [];
  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.lines.push(String(chunk));
    callback();
  }
}

describe("createLogger", () => {
  it("emits structured JSON with bindings", () => {
    const dest = new MemoryStream();
    const logger = createLogger({ level: "debug", destination: dest });
    logger
      .child({ subsystem: "dispatch", requestId: "r1" })
      .info(
        { event: "command.execute", command: "ping", durationMs: 3 },
        "done",
      );
    expect(dest.lines).toHaveLength(1);
    const line = JSON.parse(dest.lines[0] as string) as Record<string, unknown>;
    expect(line.subsystem).toBe("dispatch");
    expect(line.requestId).toBe("r1");
    expect(line.command).toBe("ping");
    expect(line.durationMs).toBe(3);
    expect(line.msg).toBe("done");
    expect(typeof line.time).toBe("number");
  });

  it("redacts tokens and authorization headers", () => {
    const dest = new MemoryStream();
    const logger = createLogger({ destination: dest });
    const secret = "super-secret-token-value";
    logger.info(
      {
        token: secret,
        nested: { token: secret },
        headers: { authorization: "Bearer abc" },
      },
      "leak?",
    );
    const raw = dest.lines.join("\n");
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain("Bearer abc");
    expect(raw).toContain("[REDACTED]");
  });

  it("child loggers merge bindings", () => {
    const dest = new MemoryStream();
    const logger = createLogger({ destination: dest });
    logger.child({ subsystem: "a" }).child({ event: "b" }).info({}, "hi");
    const line = JSON.parse(dest.lines[0] as string) as Record<string, unknown>;
    expect(line.subsystem).toBe("a");
    expect(line.event).toBe("b");
  });
});
