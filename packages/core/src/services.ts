import { FrameworkError } from "./errors.js";

export type ServiceKey = string | symbol;

/**
 * Minimal service container: explicit `register` at bootstrap, `get` on the
 * hot path (`Map` lookup, no reflection). Available to handlers as
 * `ctx.services`. Deliberately small — no decorators, no auto-wiring.
 */
export class ServiceContainer {
  private readonly services = new Map<ServiceKey, unknown>();

  register<T>(key: ServiceKey, value: T): void {
    if (this.services.has(key)) {
      throw new FrameworkError({
        code: "FRAMEWORK_SERVICE_ALREADY_REGISTERED",
        category: "Internal",
        message: `Service already registered for key: ${String(key)}`,
        context: { subsystem: "services", event: "service.register" },
        diagnostic: {
          likelyCause: "register() was called twice with the same key.",
          suggestedInvestigation: [
            "Search for duplicate services.register() calls with this key.",
            "If two plugins provide the same service, namespace the keys.",
          ],
        },
      });
    }
    this.services.set(key, value);
  }

  get<T>(key: ServiceKey): T {
    if (!this.services.has(key)) {
      throw new FrameworkError({
        code: "FRAMEWORK_SERVICE_NOT_FOUND",
        category: "Internal",
        message: `No service registered for key: ${String(key)}`,
        context: { subsystem: "services", event: "service.resolve" },
        diagnostic: {
          likelyCause:
            "The service was never registered, or the key is misspelled.",
          suggestedInvestigation: [
            "Register the service during bootstrap before bot.start().",
            "Check that plugins providing the service were loaded via bot.plugin().",
          ],
        },
      });
    }
    return this.services.get(key) as T;
  }

  has(key: ServiceKey): boolean {
    return this.services.has(key);
  }

  /** Non-throwing lookup for optional integrations. */
  tryGet<T>(key: ServiceKey): T | undefined {
    return this.has(key) ? (this.services.get(key) as T) : undefined;
  }

  /** Registered keys, for diagnostics and health checks. */
  keys(): ServiceKey[] {
    return [...this.services.keys()];
  }
}
