import type { CommandDefinition } from "./command.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import type { ServiceContainer } from "./services.js";

/** Capabilities exposed to plugins. No framework internals leak through. */
export interface PluginHost {
  command(definition: CommandDefinition): void;
  use(middleware: Middleware): void;
  readonly services: ServiceContainer;
  readonly logger: FrameworkLogger;
}

export interface Plugin {
  readonly name: string;
  setup(host: PluginHost): void | Promise<void>;
}
