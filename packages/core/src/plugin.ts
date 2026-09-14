import type { AutocompleteDefinition } from "./autocomplete.js";
import type { BotLifecycleEvent, LifecycleHook } from "./bot.js";
import type { CommandDefinition } from "./command.js";
import type { ComponentDefinition } from "./components.js";
import type { ContextMenuDefinition } from "./context-menu.js";
import { FrameworkError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import type { ModalDefinition } from "./modals.js";
import type { ServiceContainer } from "./services.js";

/**
 * Capabilities exposed to plugins and modules. No framework internals leak
 * through — units register resources, middleware, guards, and hooks.
 */
export interface PluginHost {
  command(definition: CommandDefinition): void;
  component(definition: ComponentDefinition): void;
  modal(definition: ModalDefinition): void;
  autocomplete(definition: AutocompleteDefinition): void;
  contextMenu(definition: ContextMenuDefinition): void;
  use(middleware: Middleware): void;
  guard(guard: Guard): void;
  on(event: BotLifecycleEvent, hook: LifecycleHook): void;
  readonly services: ServiceContainer;
  readonly logger: FrameworkLogger;
}

export interface Plugin {
  readonly name: string;
  readonly version?: string | undefined;
  /** Names of units that must be registered first. */
  readonly dependencies?: readonly string[] | undefined;
  setup(host: PluginHost): void | Promise<void>;
}

export function definePlugin<const T extends Plugin>(plugin: T): T {
  return plugin;
}

/** Assert a unit name is claimed at most once across plugins and modules. */
export function claimUnitName(
  units: Map<string, string>,
  kind: string,
  name: string,
): void {
  const existing = units.get(name);
  if (existing !== undefined) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Duplicate ${kind} name: "${name}" is already registered as ${existing}`,
      context: {
        subsystem: kind === "plugin" ? "plugins" : "modules",
        event: `${kind}.register`,
      },
      diagnostic: {
        likelyCause: `Two ${kind}s share the name "${name}".`,
        suggestedInvestigation: [`Rename one of the ${kind}s.`],
      },
    });
  }
  units.set(name, kind);
}

/** Assert every named dependency was registered before this unit. */
export function assertUnitDependencies(
  units: Map<string, string>,
  kind: string,
  name: string,
  dependencies: readonly string[] | undefined,
): void {
  for (const dependency of dependencies ?? []) {
    if (!units.has(dependency)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `${kind === "plugin" ? "Plugin" : "Module"} "${name}" requires "${dependency}", which is not registered`,
        context: {
          subsystem: kind === "plugin" ? "plugins" : "modules",
          event: `${kind}.register`,
        },
        diagnostic: {
          likelyCause: `Registration order: "${dependency}" must be registered before "${name}".`,
          suggestedInvestigation: [
            `Register "${dependency}" before "${name}".`,
            "Check the dependency name for typos.",
          ],
        },
      });
    }
  }
}
