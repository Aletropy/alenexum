import { assertValidCommandName, type CommandDefinition } from "./command.js";
import { FrameworkError } from "./errors.js";

/**
 * Command registry. All validation and duplicate detection happens at
 * bootstrap (`register`); the hot path is a single `Map.get`.
 */
export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

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
    if (this.commands.has(definition.name)) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Duplicate command registration: "${definition.name}"`,
        context: {
          subsystem: "registry",
          event: "command.register",
          command: definition.name,
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
    this.commands.set(definition.name, definition);
  }

  /** Hot path: direct map lookup. */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  get size(): number {
    return this.commands.size;
  }

  names(): string[] {
    return [...this.commands.keys()];
  }

  definitions(): CommandDefinition[] {
    return [...this.commands.values()];
  }
}
