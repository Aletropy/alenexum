import { assertValidCommandName, type CommandDefinition } from "./command.js";
import { FrameworkError } from "./errors.js";

/**
 * Registries. All validation and duplicate detection happens at bootstrap
 * (`register`); hot-path dispatch is `Map.get` (exact) plus, for customIds,
 * a bounded series of `Map.get` probes over `:`-separated prefixes. No
 * linear scans, no per-request reflection.
 */
export class Registry<T> {
  protected readonly entries = new Map<string, T>();

  protected store(
    key: string,
    value: T,
    duplicate: () => FrameworkError,
  ): void {
    if (this.entries.has(key)) {
      throw duplicate();
    }
    this.entries.set(key, value);
  }

  /** Hot path: direct map lookup. */
  get(key: string): T | undefined {
    return this.entries.get(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get size(): number {
    return this.entries.size;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  values(): T[] {
    return [...this.entries.values()];
  }
}

/** Command registry keyed by slash-command name. */
export class CommandRegistry extends Registry<CommandDefinition> {
  register(definition: CommandDefinition): void {
    assertValidCommandName(definition.name);
    if (typeof definition.execute !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Command "${definition.name}" must define an execute() function`,
        context: {
          subsystem: "registry",
          event: "command.register",
          command: definition.name,
        },
      });
    }
    if (
      typeof definition.description !== "string" ||
      definition.description.length === 0
    ) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Command "${definition.name}" must define a non-empty description`,
        context: {
          subsystem: "registry",
          event: "command.register",
          command: definition.name,
        },
      });
    }
    this.store(definition.name, definition, () =>
      duplicateCommandError(definition.name),
    );
  }

  names(): string[] {
    return this.keys();
  }

  definitions(): CommandDefinition[] {
    return this.values();
  }
}

function duplicateCommandError(name: string): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INVALID_CONFIGURATION",
    category: "Config",
    message: `Duplicate command registration: "${name}"`,
    context: {
      subsystem: "registry",
      event: "command.register",
      command: name,
    },
    diagnostic: {
      likelyCause:
        "bot.command() was called twice with the same name (possibly from two plugins).",
      suggestedInvestigation: [
        "Search for duplicate bot.command() calls with this name.",
        "If two plugins own the command, rename one of them.",
      ],
    },
  });
}

/**
 * Registry for customId-routed definitions (components, modals).
 *
 * Convention: `customId` segments split on `:`. Registering `"vote"` matches
 * `"vote"` exactly plus `"vote:<anything...>"`, with trailing segments
 * exposed as `args`. Exact registrations win (`"vote:yes"` beats `"vote"`).
 */
export class CustomIdRegistry<
  T extends { readonly customId: string },
> extends Registry<T> {
  registerCustomId(
    definition: T,
    options: { kind: string; registerEvent: string; registerCall: string },
  ): void {
    assertValidCustomId(definition.customId, options);
    if (typeof (definition as { execute?: unknown }).execute !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `${options.kind} "${definition.customId}" must define an execute() function`,
        context: {
          subsystem: "registry",
          event: options.registerEvent,
          command: definition.customId,
        },
      });
    }
    this.store(definition.customId, definition, () =>
      duplicateCustomIdError(definition.customId, options),
    );
  }

  resolve(customId: string): { definition: T; args: string[] } | undefined {
    const exact = this.entries.get(customId);
    if (exact !== undefined) {
      return { definition: exact, args: [] };
    }
    const segments = customId.split(":");
    for (let end = segments.length - 1; end >= 1; end--) {
      const prefix = segments.slice(0, end).join(":");
      const definition = this.entries.get(prefix);
      if (definition !== undefined) {
        return { definition, args: segments.slice(end) };
      }
    }
    return undefined;
  }
}

export function assertValidCustomId(
  customId: string,
  options: { kind: string; registerEvent: string; registerCall: string },
): void {
  if (
    typeof customId !== "string" ||
    customId.length === 0 ||
    customId.length > 100
  ) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid ${options.kind} customId "${customId}": must be 1-100 characters (Discord limit)`,
      context: {
        subsystem: "registry",
        event: options.registerEvent,
        command: customId,
      },
      diagnostic: {
        likelyCause:
          "The customId is empty or exceeds Discord's 100-character limit.",
        suggestedInvestigation: [
          `Use short ${options.kind} ids and put payload in ":"-separated args (matched by prefix).`,
          `Check the ${options.registerCall} call for this id.`,
        ],
      },
    });
  }
}

function duplicateCustomIdError(
  customId: string,
  options: { kind: string; registerEvent: string; registerCall: string },
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INVALID_CONFIGURATION",
    category: "Config",
    message: `Duplicate ${options.kind} registration: "${customId}"`,
    context: {
      subsystem: "registry",
      event: options.registerEvent,
      command: customId,
    },
    diagnostic: {
      likelyCause: `${options.registerCall} was called twice with the same customId.`,
      suggestedInvestigation: [
        `Search for duplicate ${options.registerCall} calls with this id.`,
      ],
    },
  });
}

/**
 * Autocomplete registry keyed by command, then option. An option-specific
 * handler wins; a command-level handler (registered without `option`) is the
 * fallback. Hot path is two `Map.get` probes.
 */
export class AutocompleteRegistry<T> {
  private readonly entries = new Map<string, T>();

  private static key(command: string, option: string | undefined): string {
    return `${command}\n${option ?? ""}`;
  }

  register(
    command: string,
    option: string | undefined,
    value: T,
    registerCall: string,
  ): void {
    if (command.length === 0) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: "Autocomplete registration requires a non-empty command name",
        context: { subsystem: "registry", event: "autocomplete.register" },
      });
    }
    const key = AutocompleteRegistry.key(command, option);
    if (this.entries.has(key)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Duplicate autocomplete registration for "${describeTarget(command, option)}"`,
        context: {
          subsystem: "registry",
          event: "autocomplete.register",
          command,
        },
        diagnostic: {
          likelyCause: `${registerCall} was called twice for the same command/option.`,
          suggestedInvestigation: [
            "Search for duplicate autocomplete registrations.",
          ],
        },
      });
    }
    this.entries.set(key, value);
  }

  resolve(command: string, option: string): T | undefined {
    return (
      this.entries.get(AutocompleteRegistry.key(command, option)) ??
      this.entries.get(AutocompleteRegistry.key(command, undefined))
    );
  }

  get size(): number {
    return this.entries.size;
  }
}

function describeTarget(command: string, option: string | undefined): string {
  return option === undefined ? command : `${command}:${option}`;
}
