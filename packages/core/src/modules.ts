import type { PluginHost } from "./plugin.js";

/**
 * Modules: feature slices (commands, components, services) composed into the
 * application. Plugins are the same mechanism with cross-cutting intent
 * (middleware, guards, transports) — one registry, two vocabularies:
 * use modules for features, plugins for extensions.
 */
export interface ModuleDefinition {
  readonly name: string;
  readonly version?: string | undefined;
  /** Names of units that must be registered first. */
  readonly dependencies?: readonly string[] | undefined;
  setup(host: PluginHost): void | Promise<void>;
}

export function defineModule<const T extends ModuleDefinition>(module: T): T {
  return module;
}
