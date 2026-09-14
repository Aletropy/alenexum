import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AutocompleteDefinition } from "./autocomplete.js";
import type { CommandDefinition } from "./command.js";
import type { ComponentDefinition } from "./components.js";
import type { ContextMenuDefinition } from "./context-menu.js";
import { FrameworkError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import type { ModalDefinition } from "./modals.js";
import type { ModuleDefinition } from "./modules.js";
import type { Plugin, PluginHost } from "./plugin.js";

/**
 * Bootstrap directory loading: register every definition default-exported
 * from the files in a directory, instead of one import + one call per file.
 *
 * This is explicit bulk registration, not magic discovery: the call site
 * names the directory and the kind, files load in sorted order, every
 * module is validated by the same registries as manual calls, and every
 * outcome is logged. Discovery never happens on the hot path — only here,
 * at bootstrap.
 *
 * Conventions per file:
 * - The default export must be a single definition or an array of them.
 * - Files without a default export, with non-module extensions, dotfiles,
 *   and (unless `recursive`) subdirectories are skipped only if they cannot
 *   match; a matched file that fails to import or validate aborts the load
 *   (fail-fast, like all bootstrap validation).
 */

export interface LoadOptions {
  /** Descend into subdirectories (skips node_modules and dot-dirs). */
  readonly recursive?: boolean | undefined;
  /** Only load files whose basename matches. */
  readonly pattern?: RegExp | undefined;
  /** Module extensions to consider. Defaults to JS/TS module extensions. */
  readonly extensions?: readonly string[] | undefined;
}

export interface LoadedDefinition {
  /** Absolute file the definition was loaded from. */
  readonly file: string;
  readonly kind: string;
  /** Registry key (command name, customId, unit name, …). */
  readonly key: string;
}

export interface LoadReport {
  readonly dir: string;
  readonly loaded: readonly LoadedDefinition[];
}

export interface LoadDefinitionsOptions extends LoadOptions {
  readonly kind: string;
  /**
   * Validate and register one default-exported value, returning one report
   * key per definition registered. Throw `FrameworkError` on invalid input;
   * registration failures from host methods propagate with file context.
   */
  readonly register: (
    value: unknown,
    file: string,
  ) => string[] | Promise<string[]>;
}

/** Minimal host for synchronous definitions (satisfied by `Bot`). */
export type SyncLoaderHost = Pick<
  PluginHost,
  | "command"
  | "component"
  | "modal"
  | "autocomplete"
  | "contextMenu"
  | "use"
  | "guard"
> & {
  readonly logger: FrameworkLogger;
};

/** Minimal host for plugins (satisfied by `Bot`). */
export interface PluginLoaderHost {
  plugin(plugin: Plugin): Promise<unknown>;
  readonly logger: FrameworkLogger;
}

/** Minimal host for modules (satisfied by `Bot`). */
export interface ModuleLoaderHost {
  module(definition: ModuleDefinition): Promise<unknown>;
  readonly logger: FrameworkLogger;
}

const DEFAULT_EXTENSIONS: readonly string[] = [
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
];
const DECLARATION_SUFFIXES: readonly string[] = [".d.ts", ".d.mts", ".d.cts"];

function isLoadableFile(
  name: string,
  extensions: readonly string[],
  pattern: RegExp | undefined,
): boolean {
  if (name.startsWith(".")) {
    return false;
  }
  if (
    DECLARATION_SUFFIXES.some((suffix) => name.endsWith(suffix)) ||
    name.endsWith(".map")
  ) {
    return false;
  }
  if (!extensions.includes(extname(name))) {
    return false;
  }
  if (pattern !== undefined && !pattern.test(name)) {
    return false;
  }
  return true;
}

async function collectFiles(
  dir: string,
  recursive: boolean,
  extensions: readonly string[],
  pattern: RegExp | undefined,
  out: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Cannot read directory "${dir}" for bulk loading`,
      context: { subsystem: "loader", event: "directory.read", dir },
      diagnostic: {
        likelyCause: "The directory does not exist or is not readable.",
        suggestedInvestigation: [
          `Check that "${dir}" exists, or pass an absolute path.`,
          "When running from a single-file bundle, directories are unavailable — load from source or generate a manifest instead.",
        ],
      },
      cause: error,
    });
  }
  const sorted = [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of sorted) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        recursive &&
        entry.name !== "node_modules" &&
        !entry.name.startsWith(".")
      ) {
        await collectFiles(full, recursive, extensions, pattern, out);
      }
      continue;
    }
    if (entry.isFile() && isLoadableFile(entry.name, extensions, pattern)) {
      out.push(full);
    }
  }
}

function loadFailed(
  kind: string,
  file: string,
  dir: string,
  reason: string,
  cause: unknown,
): never {
  throw new FrameworkError({
    code: "FRAMEWORK_INVALID_CONFIGURATION",
    category: "Config",
    message: `Cannot load ${kind} from "${file}": ${reason}`,
    context: { subsystem: "loader", event: `${kind}.load`, file, dir },
    diagnostic: {
      likelyCause: `The file does not export a valid ${kind} definition, or registration rejected it.`,
      suggestedInvestigation: [
        `Check that "${file}" has a default export holding a ${kind} definition (or an array of them).`,
        "If this file belongs to a different kind, point the matching loader at its directory.",
        "See the caused-by error for the underlying reason.",
      ],
    },
    cause,
  });
}

async function loadFile(
  dir: string,
  file: string,
  kind: string,
  register: (value: unknown, file: string) => string[] | Promise<string[]>,
): Promise<string[]> {
  let namespace: unknown;
  try {
    namespace = await import(pathToFileURL(file).href);
  } catch (error) {
    loadFailed(kind, file, dir, "the module threw during import", error);
  }
  if (
    typeof namespace !== "object" ||
    namespace === null ||
    !("default" in namespace) ||
    (namespace as { default: unknown }).default == null
  ) {
    loadFailed(
      kind,
      file,
      dir,
      "missing default export — export the definition (or an array of definitions) as default",
      undefined,
    );
  }
  const exported: unknown = (namespace as { default: unknown }).default;
  const items = Array.isArray(exported) ? exported : [exported];
  const keys: string[] = [];
  for (const item of items) {
    try {
      const produced = await register(item, file);
      for (const key of produced) {
        keys.push(key);
      }
    } catch (error) {
      if (
        error instanceof FrameworkError &&
        error.context.subsystem === "loader"
      ) {
        throw error;
      }
      const reason =
        error instanceof Error
          ? error.message
          : "registration rejected the value";
      loadFailed(kind, file, dir, reason, error);
    }
  }
  return keys;
}

/**
 * Generic bootstrap loader. Prefer the per-kind functions below; use this
 * directly only for custom definition kinds.
 */
export async function loadDefinitions(
  host: { readonly logger: FrameworkLogger },
  dir: string,
  options: LoadDefinitionsOptions,
): Promise<LoadReport> {
  const root = resolve(dir);
  const files: string[] = [];
  await collectFiles(
    root,
    options.recursive ?? false,
    options.extensions ?? DEFAULT_EXTENSIONS,
    options.pattern,
    files,
  );
  const loaded: LoadedDefinition[] = [];
  for (const file of files) {
    const keys = await loadFile(root, file, options.kind, options.register);
    for (const key of keys) {
      loaded.push({ file, kind: options.kind, key });
      host.logger.debug(
        {
          subsystem: "loader",
          event: `${options.kind}.loaded`,
          command: key,
          file,
          dir: root,
        },
        `Loaded ${options.kind} "${key}" from ${basename(file)}`,
      );
    }
  }
  host.logger.info(
    {
      subsystem: "loader",
      event: "directory.loaded",
      dir: root,
      kind: options.kind,
      loaded: loaded.length,
    },
    `Loaded ${loaded.length} ${options.kind}(s) from ${root}`,
  );
  return { dir: root, loaded };
}

export async function loadCommands(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "command",
    register: (value) => {
      const definition = value as CommandDefinition;
      host.command(definition);
      return [definition.name];
    },
  });
}

export async function loadComponents(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "component",
    register: (value) => {
      const definition = value as ComponentDefinition;
      host.component(definition);
      return [definition.customId];
    },
  });
}

export async function loadModals(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "modal",
    register: (value) => {
      const definition = value as ModalDefinition;
      host.modal(definition);
      return [definition.customId];
    },
  });
}

export async function loadAutocomplete(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "autocomplete",
    register: (value) => {
      const definition = value as AutocompleteDefinition;
      host.autocomplete(definition);
      return [
        definition.option === undefined
          ? definition.command
          : `${definition.command}:${definition.option}`,
      ];
    },
  });
}

export async function loadContextMenus(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "contextmenu",
    register: (value) => {
      const definition = value as ContextMenuDefinition;
      host.contextMenu(definition);
      return [definition.name];
    },
  });
}

export async function loadMiddleware(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "middleware",
    register: (value) => {
      host.use(value as Middleware);
      const name =
        typeof value === "function" && value.name !== ""
          ? value.name
          : "(anonymous)";
      return [name];
    },
  });
}

export async function loadGuards(
  host: SyncLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "guard",
    register: (value) => {
      host.guard(value as Guard);
      if (typeof value === "function") {
        return [value.name === "" ? "(anonymous)" : value.name];
      }
      return [(value as { name: string }).name];
    },
  });
}

export async function loadPlugins(
  host: PluginLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "plugin",
    register: async (value) => {
      const plugin = value as Plugin;
      await host.plugin(plugin);
      return [plugin.name];
    },
  });
}

export async function loadModules(
  host: ModuleLoaderHost,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions(host, dir, {
    ...options,
    kind: "module",
    register: async (value) => {
      const definition = value as ModuleDefinition;
      await host.module(definition);
      return [definition.name];
    },
  });
}
