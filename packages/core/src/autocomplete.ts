import { randomUUID } from "node:crypto";
import {
  type BaseInteractionContext,
  extractInteractionIds,
} from "./context.js";
import { FrameworkError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import {
  type CommandOptionsMap,
  type OptionValues,
  parseOptions,
} from "./options.js";
import type { ServiceContainer } from "./services.js";

/**
 * Autocomplete interactions. Handlers are registered per command with an
 * optional per-option specialization (`bot.autocomplete`); a command-level
 * handler is the fallback. Partial user input is parsed leniently into
 * `ctx.options` — incomplete/invalid values read as `undefined` instead of
 * failing, since the user is still typing.
 */
export interface AutocompleteChoice {
  readonly name: string;
  readonly value: string | number;
}

export interface FocusedOption {
  readonly name: string;
  readonly value: string | number;
}

export interface AutocompleteContext extends BaseInteractionContext {
  readonly commandName: string;
  readonly focused: FocusedOption;
  /** Partial input parsed leniently against the command's option schema. */
  readonly options: OptionValues;
  /** Whether choices were sent. The router auto-responds `[]` otherwise. */
  readonly responded: boolean;
  respond(choices: readonly AutocompleteChoice[]): Promise<void>;
}

export interface AutocompleteDefinition {
  readonly command: string;
  readonly option?: string | undefined;
  execute(ctx: AutocompleteContext): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

export function defineAutocomplete<const T extends AutocompleteDefinition>(
  definition: T,
): T {
  return definition;
}

export interface CreateAutocompleteContextInit {
  interaction: unknown;
  commandName: string;
  focused: FocusedOption;
  /** Command's option schema for lenient partial parsing (optional). */
  schema?: CommandOptionsMap | undefined;
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
}

/**
 * Read the focused option via discord.js `getFocused(true)`
 * (`{ name, value }`). Never throws anything but FrameworkError.
 */
export function extractFocusedOption(
  raw: unknown,
  ctx: { command: string; requestId: string },
): FocusedOption {
  if (typeof raw !== "object" || raw === null) {
    throw focusedError(ctx, "interaction is not an object");
  }
  const options = (raw as { options?: unknown }).options;
  if (typeof options !== "object" || options === null) {
    throw focusedError(ctx, "interaction carries no option resolver");
  }
  const getFocused = (options as { getFocused?: unknown }).getFocused;
  if (typeof getFocused !== "function") {
    throw focusedError(ctx, "option resolver does not support getFocused()");
  }
  let focused: unknown;
  try {
    focused = (getFocused as (full: boolean) => unknown).call(options, true);
  } catch (error) {
    throw focusedError(
      ctx,
      error instanceof Error ? error.message : "getFocused() threw",
    );
  }
  if (typeof focused !== "object" || focused === null) {
    throw focusedError(ctx, "focused option has an unexpected shape");
  }
  const record = focused as Record<string, unknown>;
  if (
    typeof record.name !== "string" ||
    (typeof record.value !== "string" && typeof record.value !== "number")
  ) {
    throw focusedError(ctx, "focused option has an unexpected shape");
  }
  return { name: record.name, value: record.value };
}

function focusedError(
  ctx: { command: string; requestId: string },
  reason: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_COMMAND_VALIDATION_FAILED",
    category: "Validation",
    message: `Cannot read focused option for command "${ctx.command}": ${reason}`,
    context: {
      subsystem: "dispatch",
      event: "autocomplete.focused",
      command: ctx.command,
      requestId: ctx.requestId,
    },
  });
}

export function createAutocompleteContext(
  init: CreateAutocompleteContextInit,
): AutocompleteContext {
  const requestId = init.requestId ?? randomUUID();
  const ids = extractInteractionIds(init.interaction);
  const options =
    init.schema === undefined
      ? {}
      : parseOptions(
          init.interaction,
          init.schema,
          { command: init.commandName, requestId },
          { lenient: true },
        );

  let responded = false;
  return {
    ...ids,
    route: init.commandName,
    requestId,
    logger: init.logger,
    services: init.services,
    interaction: init.interaction,
    client: init.client,
    commandName: init.commandName,
    focused: init.focused,
    options,
    get responded() {
      return responded;
    },
    respond: async (choices: readonly AutocompleteChoice[]): Promise<void> => {
      validateChoices(init.commandName, requestId, choices);
      const record =
        typeof init.interaction === "object" && init.interaction !== null
          ? (init.interaction as Record<string, unknown>)
          : undefined;
      const respond = record?.respond;
      if (typeof respond !== "function") {
        throw new FrameworkError({
          code: "FRAMEWORK_INTERNAL",
          category: "Internal",
          message: `Interaction for command "${init.commandName}" does not support respond()`,
          context: {
            subsystem: "dispatch",
            event: "autocomplete.respond",
            command: init.commandName,
            requestId,
          },
        });
      }
      await (
        respond as (choices: readonly AutocompleteChoice[]) => Promise<unknown>
      ).call(init.interaction, choices);
      responded = true;
    },
  };
}

function validateChoices(
  command: string,
  requestId: string,
  choices: readonly AutocompleteChoice[],
): void {
  if (choices.length > 25) {
    throw new FrameworkError({
      code: "FRAMEWORK_COMMAND_VALIDATION_FAILED",
      category: "Validation",
      message: `Too many autocomplete choices for command "${command}": Discord allows at most 25`,
      context: {
        subsystem: "dispatch",
        event: "autocomplete.respond",
        command,
        requestId,
      },
    });
  }
  for (const choice of choices) {
    if (
      typeof choice !== "object" ||
      choice === null ||
      typeof choice.name !== "string" ||
      (typeof choice.value !== "string" && typeof choice.value !== "number")
    ) {
      throw new FrameworkError({
        code: "FRAMEWORK_COMMAND_VALIDATION_FAILED",
        category: "Validation",
        message: `Malformed autocomplete choice for command "${command}": each choice needs a string name and a string|number value`,
        context: {
          subsystem: "dispatch",
          event: "autocomplete.respond",
          command,
          requestId,
        },
      });
    }
  }
}
