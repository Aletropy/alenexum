import type { CommandContext } from "./context.js";
import { FrameworkError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { Middleware } from "./middleware.js";
import type { CommandOptionsMap, InferOptionValues } from "./options.js";

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

/**
 * Stored command shape used by the registry and dispatch. `execute` is
 * declared with method syntax (bivariant) so specifically-typed commands
 * produced by `defineCommand` are assignable without casts.
 */
export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly options?: CommandOptionsMap | undefined;
  /**
   * Discord permission bitfield serialized as a string (client-side gating;
   * runtime enforcement still belongs to guards). Deployed verbatim.
   */
  readonly defaultMemberPermissions?: string | null | undefined;
  execute(ctx: CommandContext): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

/**
 * Input shape for `defineCommand`. The `execute` context's `options` are
 * inferred from the `options` schema in the same object literal — including
 * required-vs-optional and choice literal unions.
 */
export interface DefineCommandInput<TSchema extends CommandOptionsMap> {
  readonly name: string;
  readonly description: string;
  readonly options?: TSchema | undefined;
  readonly defaultMemberPermissions?: string | null | undefined;
  execute(
    ctx: CommandContext<InferOptionValues<TSchema>>,
  ): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

/**
 * Define a command. `TOptions` is inferred directly from the `options` map so
 * the `execute` context's `options` are fully typed (required vs optional,
 * choice literal unions); `TName` preserves the literal command name. `const`
 * type parameters keep literals without manual annotations.
 */
export function defineCommand<
  const TName extends string,
  const TOptions extends CommandOptionsMap = Record<string, never>,
>(
  definition: DefineCommandInput<TOptions> & { readonly name: TName },
): DefineCommandInput<TOptions> & { readonly name: TName } {
  return definition;
}
