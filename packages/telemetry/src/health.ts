import { FrameworkError } from "@nexum/core";

/**
 * Health monitoring: named checks with timeouts, aggregated into a
 * readiness-style report. The framework never owns a port — serve
 * `monitor.check()` from your own `/healthz` route.
 */
export type HealthCheckStatus = "pass" | "fail" | "timeout";
export type OverallHealth = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  readonly name: string;
  readonly status: HealthCheckStatus;
  readonly latencyMs: number;
  readonly message?: string | undefined;
}

export interface HealthReport {
  readonly status: OverallHealth;
  readonly uptimeMs: number;
  readonly timestamp: string;
  readonly checks: HealthCheckResult[];
}

export type HealthCheckFn = () => boolean | Promise<boolean>;

export interface HealthCheckOptions {
  /** Per-check timeout; defaults to the monitor default. */
  readonly timeoutMs?: number | undefined;
  /** Non-critical failures degrade instead of failing the report. */
  readonly critical?: boolean | undefined;
}

interface RegisteredCheck {
  readonly check: HealthCheckFn;
  readonly timeoutMs: number;
  readonly critical: boolean;
}

export class HealthMonitor {
  private readonly checks = new Map<string, RegisteredCheck>();
  private readonly startedAt = Date.now();

  constructor(private readonly defaultTimeoutMs = 2000) {}

  register(
    name: string,
    check: HealthCheckFn,
    options?: HealthCheckOptions,
  ): void {
    if (typeof name !== "string" || name.length === 0) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: "Health checks require a non-empty name",
        context: { subsystem: "health", event: "health.register" },
      });
    }
    if (typeof check !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Health check "${name}" requires a check function`,
        context: { subsystem: "health", event: "health.register" },
      });
    }
    if (this.checks.has(name)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Duplicate health check registration: "${name}"`,
        context: { subsystem: "health", event: "health.register" },
      });
    }
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Health check "${name}" needs a finite positive timeoutMs`,
        context: { subsystem: "health", event: "health.register" },
      });
    }
    this.checks.set(name, {
      check,
      timeoutMs,
      critical: options?.critical ?? true,
    });
  }

  getUptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  async check(): Promise<HealthReport> {
    const entries = [...this.checks.entries()];
    const results = await Promise.all(
      entries.map(([name, registered]) => this.runOne(name, registered)),
    );
    let status: OverallHealth = "healthy";
    for (const [index, result] of results.entries()) {
      if (result.status === "pass") {
        continue;
      }
      if ((entries[index] as [string, RegisteredCheck])[1].critical) {
        status = "unhealthy";
        break;
      }
      status = "degraded";
    }
    return {
      status,
      uptimeMs: this.getUptimeMs(),
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }

  private async runOne(
    name: string,
    registered: RegisteredCheck,
  ): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        Promise.resolve().then(() => registered.check()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`timed out after ${registered.timeoutMs}ms`)),
            registered.timeoutMs,
          );
          timer.unref?.();
        }),
      ]);
      if (outcome === true) {
        return { name, status: "pass", latencyMs: Date.now() - startedAt };
      }
      return {
        name,
        status: "fail",
        latencyMs: Date.now() - startedAt,
        message: "check returned false",
      };
    } catch (error) {
      const timedOut =
        error instanceof Error && error.message.startsWith("timed out after");
      return {
        name,
        status: timedOut ? "timeout" : "fail",
        latencyMs: Date.now() - startedAt,
        message:
          error instanceof Error
            ? error.message
            : "check threw an unknown value",
      };
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}

/**
 * Gateway liveness from a discord.js client, read structurally (fail-closed).
 * Pass `connector.client`; true only while the client reports ready.
 */
export function discordClientCheck(client: {
  isReady(): boolean;
}): HealthCheckFn {
  return () => {
    try {
      return client.isReady() === true;
    } catch {
      return false;
    }
  };
}
