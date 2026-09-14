import { FrameworkError } from "./errors.js";

/**
 * Command option schema, parsing, and type inference.
 *
 * Core owns a discord.js-agnostic *data* schema (plain interfaces) plus
 * runtime parsing from a structural resolver. `@nexum/discord`
 * converts the same schema to discord.js builders for REST deployment.
 * discord.js is never imported here.
 */

// -- resolved entity shapes (structural: discord.js instances satisfy these) --

/** A Discord user reference passed to a command. Escape hatch: the raw value is the discord.js `User`. */
export interface ResolvedUser {
  readonly id: string;
}

/** A Discord channel reference. Escape hatch: the raw value is the discord.js channel. */
export interface ResolvedChannel {
  readonly id: string;
}

/** A Discord role reference. */
export interface ResolvedRole {
  readonly id: string;
}

/** A mentionable (user or role) reference. */
export interface ResolvedMentionable {
  readonly id: string;
}

/** A Discord attachment reference. */
export interface ResolvedAttachment {
  readonly id: string;
  readonly url: string;
}

// -- schema ------------------------------------------------------------------

export interface Choice<T extends string | number = string | number> {
  readonly name: string;
  readonly value: T;
}

export interface StringOption<
  R extends boolean = boolean,
  C extends readonly Choice<string>[] = readonly Choice<string>[],
> {
  readonly type: "string";
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minLength?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}

export interface IntegerOption<
  R extends boolean = boolean,
  C extends readonly Choice<number>[] = readonly Choice<number>[],
> {
  readonly type: "integer";
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}

export interface NumberOption<
  R extends boolean = boolean,
  C extends readonly Choice<number>[] = readonly Choice<number>[],
> {
  readonly type: "number";
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}

export interface BooleanOption<R extends boolean = boolean> {
  readonly type: "boolean";
  readonly description: string;
  readonly required?: R | undefined;
}

export interface UserOption<R extends boolean = boolean> {
  readonly type: "user";
  readonly description: string;
  readonly required?: R | undefined;
}

export interface ChannelOption<R extends boolean = boolean> {
  readonly type: "channel";
  readonly description: string;
  readonly required?: R | undefined;
}

export interface RoleOption<R extends boolean = boolean> {
  readonly type: "role";
  readonly description: string;
  readonly required?: R | undefined;
}

export interface MentionableOption<R extends boolean = boolean> {
  readonly type: "mentionable";
  readonly description: string;
  readonly required?: R | undefined;
}

export interface AttachmentOption<R extends boolean = boolean> {
  readonly type: "attachment";
  readonly description: string;
  readonly required?: R | undefined;
}

export type OptionDefinition =
  | StringOption<boolean, readonly Choice<string>[]>
  | IntegerOption<boolean, readonly Choice<number>[]>
  | NumberOption<boolean, readonly Choice<number>[]>
  | BooleanOption<boolean>
  | UserOption<boolean>
  | ChannelOption<boolean>
  | RoleOption<boolean>
  | MentionableOption<boolean>
  | AttachmentOption<boolean>;

export type CommandOptionsMap = Record<string, OptionDefinition>;

/** Runtime values after parsing. Entity values are the discord.js instances, typed structurally. */
export type OptionValues = Record<string, unknown>;

// -- builders ------------------------------------------------------------------

export function stringOption<
  const C extends readonly Choice<string>[] = readonly [],
  const R extends boolean = boolean,
>(options: {
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minLength?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}): StringOption<R, C> {
  return { type: "string", ...options };
}

export function integerOption<
  const C extends readonly Choice<number>[] = readonly [],
  const R extends boolean = boolean,
>(options: {
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}): IntegerOption<R, C> {
  return { type: "integer", ...options };
}

export function numberOption<
  const C extends readonly Choice<number>[] = readonly [],
  const R extends boolean = boolean,
>(options: {
  readonly description: string;
  readonly required?: R | undefined;
  readonly choices?: C | undefined;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly autocomplete?: boolean | undefined;
}): NumberOption<R, C> {
  return { type: "number", ...options };
}

export function booleanOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): BooleanOption<R> {
  return { type: "boolean", ...options };
}

export function userOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): UserOption<R> {
  return { type: "user", ...options };
}

export function channelOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): ChannelOption<R> {
  return { type: "channel", ...options };
}

export function roleOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): RoleOption<R> {
  return { type: "role", ...options };
}

export function mentionableOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): MentionableOption<R> {
  return { type: "mentionable", ...options };
}

export function attachmentOption<const R extends boolean = boolean>(options: {
  readonly description: string;
  readonly required?: R | undefined;
}): AttachmentOption<R> {
  return { type: "attachment", ...options };
}

// -- inference -------------------------------------------------------------------

type WithRequired<V, R> = R extends true ? V : V | undefined;

type ChoiceValues<C> = C extends readonly { readonly value: infer V }[]
  ? V
  : never;

export type InferSingleOption<O extends OptionDefinition> =
  O extends StringOption<infer R, infer C>
    ? [ChoiceValues<C>] extends [never]
      ? WithRequired<string, R>
      : WithRequired<Extract<ChoiceValues<C>, string>, R>
    : O extends IntegerOption<infer R, infer C> | NumberOption<infer R, infer C>
      ? [ChoiceValues<C>] extends [never]
        ? WithRequired<number, R>
        : WithRequired<Extract<ChoiceValues<C>, number>, R>
      : O extends BooleanOption<infer R>
        ? WithRequired<boolean, R>
        : O extends UserOption<infer R>
          ? WithRequired<ResolvedUser, R>
          : O extends ChannelOption<infer R>
            ? WithRequired<ResolvedChannel, R>
            : O extends RoleOption<infer R>
              ? WithRequired<ResolvedRole, R>
              : O extends MentionableOption<infer R>
                ? WithRequired<ResolvedMentionable, R>
                : O extends AttachmentOption<infer R>
                  ? WithRequired<ResolvedAttachment, R>
                  : unknown;

export type InferOptionValues<TSchema extends CommandOptionsMap> = {
  -readonly [K in keyof TSchema]: InferSingleOption<TSchema[K]>;
};

// -- parsing -------------------------------------------------------------------

/**
 * Structural subset of discord.js `CommandInteractionOptionResolver` used by
 * the parser. Getters are always called without `required` — the framework
 * validates presence itself so failures carry `FRAMEWORK_*` codes.
 */
export interface OptionResolverLike {
  getString(name: string): string | null;
  getInteger(name: string): number | null;
  getNumber(name: string): number | null;
  getBoolean(name: string): boolean | null;
  getUser(name: string): unknown;
  getChannel(name: string): unknown;
  getRole(name: string): unknown;
  getMentionable(name: string): unknown;
  getAttachment(name: string): unknown;
}

export interface ParseOptionsContext {
  readonly command: string;
  readonly requestId: string;
}

function validationError(
  ctx: ParseOptionsContext,
  optionName: string,
  reason: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_COMMAND_VALIDATION_FAILED",
    category: "Validation",
    message: `Invalid value for option "${optionName}" of command "${ctx.command}": ${reason}`,
    context: {
      subsystem: "dispatch",
      event: "options.validate",
      command: ctx.command,
      requestId: ctx.requestId,
      option: optionName,
    },
    diagnostic: {
      likelyCause:
        "Discord delivered an option value that violates the command schema (or a test fake supplied one).",
      suggestedInvestigation: [
        "Check the option definition (required, choices, min/max) against what was sent.",
        "If this came from a real interaction, Discord validation may have been bypassed — treat the payload as untrusted.",
        "If this came from a test, align the fake resolver values with the schema.",
      ],
    },
  });
}

function checkRequired(
  ctx: ParseOptionsContext,
  optionName: string,
  def: OptionDefinition,
  value: unknown,
): boolean {
  if (value === null || value === undefined) {
    if (def.required === true) {
      throw validationError(ctx, optionName, "a required option is missing");
    }
    return false;
  }
  return true;
}

function checkChoices(
  ctx: ParseOptionsContext,
  optionName: string,
  choices: readonly Choice<string | number>[] | undefined,
  value: string | number,
): void {
  if (choices !== undefined && choices.length > 0) {
    const allowed = new Set<unknown>(choices.map((choice) => choice.value));
    if (!allowed.has(value)) {
      throw validationError(
        ctx,
        optionName,
        `value is not one of the defined choices`,
      );
    }
  }
}

function entityId(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function parseSingle(
  ctx: ParseOptionsContext,
  optionName: string,
  def: OptionDefinition,
  resolver: OptionResolverLike | undefined,
): unknown {
  switch (def.type) {
    case "string": {
      const value = resolver?.getString(optionName) ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (typeof value !== "string") {
        throw validationError(ctx, optionName, "expected a string");
      }
      if (def.minLength !== undefined && value.length < def.minLength) {
        throw validationError(
          ctx,
          optionName,
          `shorter than minLength ${def.minLength}`,
        );
      }
      if (def.maxLength !== undefined && value.length > def.maxLength) {
        throw validationError(
          ctx,
          optionName,
          `longer than maxLength ${def.maxLength}`,
        );
      }
      checkChoices(ctx, optionName, def.choices, value);
      return value;
    }
    case "integer": {
      const value = resolver?.getInteger(optionName) ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw validationError(ctx, optionName, "expected an integer");
      }
      if (def.minValue !== undefined && value < def.minValue) {
        throw validationError(
          ctx,
          optionName,
          `below minValue ${def.minValue}`,
        );
      }
      if (def.maxValue !== undefined && value > def.maxValue) {
        throw validationError(
          ctx,
          optionName,
          `above maxValue ${def.maxValue}`,
        );
      }
      checkChoices(ctx, optionName, def.choices, value);
      return value;
    }
    case "number": {
      const value = resolver?.getNumber(optionName) ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw validationError(ctx, optionName, "expected a number");
      }
      if (def.minValue !== undefined && value < def.minValue) {
        throw validationError(
          ctx,
          optionName,
          `below minValue ${def.minValue}`,
        );
      }
      if (def.maxValue !== undefined && value > def.maxValue) {
        throw validationError(
          ctx,
          optionName,
          `above maxValue ${def.maxValue}`,
        );
      }
      checkChoices(ctx, optionName, def.choices, value);
      return value;
    }
    case "boolean": {
      const value = resolver?.getBoolean(optionName) ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (typeof value !== "boolean") {
        throw validationError(ctx, optionName, "expected a boolean");
      }
      return value;
    }
    case "user":
    case "channel":
    case "role":
    case "mentionable": {
      const raw =
        def.type === "user"
          ? resolver?.getUser(optionName)
          : def.type === "channel"
            ? resolver?.getChannel(optionName)
            : def.type === "role"
              ? resolver?.getRole(optionName)
              : resolver?.getMentionable(optionName);
      const value = raw ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (entityId(value) === undefined) {
        throw validationError(
          ctx,
          optionName,
          `expected a ${def.type} reference with a string id`,
        );
      }
      return value;
    }
    case "attachment": {
      const value = resolver?.getAttachment(optionName) ?? null;
      if (!checkRequired(ctx, optionName, def, value)) {
        return undefined;
      }
      if (
        typeof value !== "object" ||
        value === null ||
        entityId(value) === undefined
      ) {
        throw validationError(
          ctx,
          optionName,
          "expected an attachment reference",
        );
      }
      const url = (value as { url?: unknown }).url;
      if (typeof url !== "string") {
        throw validationError(
          ctx,
          optionName,
          "expected an attachment with a url",
        );
      }
      return value;
    }
  }
}

/**
 * Parse and validate interaction options against the command schema.
 * Discord already enforces most constraints; this is defense-in-depth for
 * malformed payloads (and fakes) so every failure is a classified
 * `FRAMEWORK_COMMAND_VALIDATION_FAILED` instead of a downstream `TypeError`.
 */
export function parseOptions(
  rawInteraction: unknown,
  schema: CommandOptionsMap | undefined,
  ctx: ParseOptionsContext,
  opts?: { lenient?: boolean | undefined },
): OptionValues {
  const values: OptionValues = {};
  if (schema === undefined) {
    return values;
  }
  const resolver =
    typeof rawInteraction === "object" && rawInteraction !== null
      ? ((rawInteraction as { options?: unknown }).options as
          | OptionResolverLike
          | undefined)
      : undefined;
  for (const [name, def] of Object.entries(schema)) {
    if (opts?.lenient === true) {
      try {
        values[name] = parseSingle(ctx, name, def, resolver);
      } catch {
        // Autocomplete input is partial by nature: unreadable values read
        // as undefined instead of failing the dispatch.
        values[name] = undefined;
      }
    } else {
      values[name] = parseSingle(ctx, name, def, resolver);
    }
  }
  return values;
}
