import type { CommandContext } from "./context.js";
import { FrameworkError } from "./errors.js";
import type { Middleware } from "./middleware.js";

/** Discord slash-command naming rules: 1–32 chars, lowercase, no spaces. */
export const COMMAND_NAME_PATTERN = /^[\p{Ll}\p{N}_-]{1,32}$/u;

export function assertValidCommandName(name: string): void {
  if (!COMMAND_NAME_PATTERN.test(name)) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid command name "${name}": must be 1-32 lowercase characters (letters, numbers, _ or -)`,
      context: {
        subsystem: "registry",
        event: "command.validate",
        command: name,
      },
      diagnostic: {
        likelyCause:
          "The command name violates Discord's application-command naming rules.",
        suggestedInvestigation: [
          "Rename the command to lowercase with only letters, numbers, _ or -.",
          "Keep the name between 1 and 32 characters.",
        ],
      },
    });
  }
}

export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly execute: (ctx: CommandContext) => void | Promise<void>;
  readonly middleware?: readonly Middleware[];
}

/**
 * Define a command. `const` type parameter preserves literal inference so
 * future option schemas flow into `ctx` typing without manual annotations.
 */
export function defineCommand<const T extends CommandDefinition>(
  definition: T,
): T {
  return definition;
}
