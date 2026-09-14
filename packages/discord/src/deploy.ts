import {
  type Bot,
  type Choice,
  type CommandDefinition,
  type ContextMenuDefinition,
  FrameworkError,
} from "@alenexum/core";
import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Convert a framework command definition (core data schema) into the
 * discord.js builder JSON posted to Discord's REST API. All Discord
 * protocol details (builders, payload shape) live here — core never sees
 * them.
 */
export function toSlashCommandJSON(
  definition: CommandDefinition,
): RESTPostAPIChatInputApplicationCommandsJSONBody {
  const builder = new SlashCommandBuilder()
    .setName(definition.name)
    .setDescription(definition.description);
  applyDefaultPermissions(
    (permissions) => builder.setDefaultMemberPermissions(permissions),
    definition.name,
    definition.defaultMemberPermissions,
  );

  for (const [name, option] of Object.entries(definition.options ?? {})) {
    if (
      (option.type === "string" ||
        option.type === "integer" ||
        option.type === "number") &&
      option.autocomplete === true &&
      option.choices !== undefined
    ) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Option "${name}" of command "${definition.name}" sets both choices and autocomplete; Discord allows only one`,
        context: {
          subsystem: "discord",
          event: "commands.deploy",
          command: definition.name,
          option: name,
        },
        diagnostic: {
          likelyCause:
            "The option schema combines choices with autocomplete: true.",
          suggestedInvestigation: [
            "Remove choices to use dynamic autocomplete, or remove autocomplete to use static choices.",
          ],
        },
      });
    }
    switch (option.type) {
      case "string":
        builder.addStringOption((entry) => {
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false);
          const choices = requireChoices(definition.name, name, option.choices);
          if (choices !== undefined) {
            entry.addChoices(choices);
          }
          if (option.minLength !== undefined) {
            entry.setMinLength(option.minLength);
          }
          if (option.maxLength !== undefined) {
            entry.setMaxLength(option.maxLength);
          }
          if (option.autocomplete === true) {
            entry.setAutocomplete(true);
          }
          return entry;
        });
        break;
      case "integer":
        builder.addIntegerOption((entry) => {
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false);
          const choices = requireChoices(definition.name, name, option.choices);
          if (choices !== undefined) {
            entry.addChoices(choices);
          }
          if (option.minValue !== undefined) {
            entry.setMinValue(option.minValue);
          }
          if (option.maxValue !== undefined) {
            entry.setMaxValue(option.maxValue);
          }
          if (option.autocomplete === true) {
            entry.setAutocomplete(true);
          }
          return entry;
        });
        break;
      case "number":
        builder.addNumberOption((entry) => {
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false);
          const choices = requireChoices(definition.name, name, option.choices);
          if (choices !== undefined) {
            entry.addChoices(choices);
          }
          if (option.minValue !== undefined) {
            entry.setMinValue(option.minValue);
          }
          if (option.maxValue !== undefined) {
            entry.setMaxValue(option.maxValue);
          }
          if (option.autocomplete === true) {
            entry.setAutocomplete(true);
          }
          return entry;
        });
        break;
      case "boolean":
        builder.addBooleanOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
      case "user":
        builder.addUserOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
      case "channel":
        builder.addChannelOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
      case "role":
        builder.addRoleOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
      case "mentionable":
        builder.addMentionableOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
      case "attachment":
        builder.addAttachmentOption((entry) =>
          entry
            .setName(name)
            .setDescription(option.description)
            .setRequired(option.required ?? false),
        );
        break;
    }
  }

  return builder.toJSON();
}

/**
 * Client-side permission gating, deployed verbatim. Runtime enforcement
 * still belongs to guards — this only controls who Discord shows/enables
 * the command for. Validated here so typos fail deploys, not silently.
 */
function applyDefaultPermissions(
  set: (permissions: string | null) => void,
  commandName: string,
  defaultMemberPermissions: string | null | undefined,
): void {
  if (defaultMemberPermissions === undefined) {
    return;
  }
  if (
    defaultMemberPermissions !== null &&
    !/^\d+$/.test(defaultMemberPermissions)
  ) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Command "${commandName}" has malformed defaultMemberPermissions: expected a decimal bitfield string`,
      context: {
        subsystem: "discord",
        event: "commands.deploy",
        command: commandName,
      },
      diagnostic: {
        likelyCause:
          "defaultMemberPermissions is not a decimal string (e.g. PermissionFlagsBits serialized).",
        suggestedInvestigation: [
          "Pass String(PermissionFlagsBits.X) or a combined bitfield string.",
          "Use '0' to disable the command for everyone by default.",
        ],
      },
    });
  }
  set(defaultMemberPermissions);
}

/**
 * Discord rejects empty choice lists and caps them at 25. An explicitly
 * empty list is almost certainly a schema bug, so fail at deploy time with
 * a classified error instead of a raw 400 from the API.
 */
function requireChoices<T extends string | number>(
  commandName: string,
  optionName: string,
  choices: readonly Choice<T>[] | undefined,
): { name: string; value: T }[] | undefined {
  if (choices === undefined) {
    return undefined;
  }
  if (choices.length === 0 || choices.length > 25) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Option "${optionName}" of command "${commandName}" has ${choices.length} choices; Discord requires 1-25`,
      context: {
        subsystem: "discord",
        event: "commands.deploy",
        command: commandName,
        option: optionName,
      },
      diagnostic: {
        likelyCause:
          "The choices array in the option schema is empty or exceeds Discord's limit.",
        suggestedInvestigation: [
          "Provide between 1 and 25 choices, or remove choices to allow free input.",
        ],
      },
    });
  }
  return choices.map((choice) => ({ name: choice.name, value: choice.value }));
}

/**
 * Convert a context-menu definition to its builder JSON (type 2 = user,
 * type 3 = message). Context-menu names may contain capitals and spaces —
 * only slash-command names follow the strict pattern.
 */
export function toContextMenuJSON(definition: ContextMenuDefinition) {
  const builder = new ContextMenuCommandBuilder()
    .setName(definition.name)
    .setType(
      definition.type === "user"
        ? ApplicationCommandType.User
        : ApplicationCommandType.Message,
    );
  applyDefaultPermissions(
    (permissions) => builder.setDefaultMemberPermissions(permissions),
    definition.name,
    definition.defaultMemberPermissions,
  );
  return builder.toJSON();
}

/**
 * Full deploy body for a bot: slash commands plus context menus.
 * Exported pure for testability; `deployCommands` PUTs its result.
 */
export function collectDeployBody(bot: Bot): unknown[] {
  return [
    ...bot
      .getCommandDefinitions()
      .map((definition) => toSlashCommandJSON(definition)),
    ...bot
      .getContextMenuDefinitions()
      .map((definition) => toContextMenuJSON(definition)),
  ];
}
