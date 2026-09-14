import { randomUUID } from "node:crypto";
import { FrameworkError } from "./errors.js";
import type { FrameworkLogger } from "./logger.js";
import type { OptionValues } from "./options.js";
import { createReplyMethods } from "./replies.js";
import type { ServiceContainer } from "./services.js";

/**
 * Fields every interaction context carries. Middleware operates on this base;
 * handlers receive the specialized extension for their interaction type.
 */
export interface BaseInteractionContext {
  /** Route key: command name, customId, or menu name. Used for logs, guards, cooldowns. */
  readonly route: string;
  readonly interactionId: string | undefined;
  readonly guildId: string | null | undefined;
  readonly channelId: string | null | undefined;
  readonly userId: string | undefined;
  readonly requestId: string;
  readonly logger: FrameworkLogger;
  readonly services: ServiceContainer;
  /** Raw discord.js interaction (escape hatch). */
  readonly interaction: unknown;
  /** Raw discord.js client (escape hatch). */
  readonly client: unknown;
}

/**
 * Handler-facing context. Common tasks (reply, logging, services, parsed
 * options) are first-class; the raw discord.js interaction/client stay
 * reachable via the `interaction` / `client` escape hatches so users never
 * wait on a wrapper.
 */
export interface CommandContext<TOptions extends OptionValues = OptionValues>
  extends BaseInteractionContext {
  readonly commandName: string;
  readonly logger: FrameworkLogger;
  readonly services: ServiceContainer;
  /** Validated option values, typed from the command's option schema. */
  readonly options: TOptions;
  /** Raw discord.js interaction (escape hatch). */
  readonly interaction: unknown;
  /** Raw discord.js client (escape hatch). */
  readonly client: unknown;
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
  update(message: string): Promise<void>;
  deferUpdate(): Promise<void>;
}

export interface CreateCommandContextInit {
  interaction: unknown;
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
  options?: OptionValues | undefined;
}

export interface InteractionIds {
  readonly interactionId: string | undefined;
  readonly guildId: string | null | undefined;
  readonly channelId: string | null | undefined;
  readonly userId: string | undefined;
}

/** True for discord.js chat-input interactions and structurally compatible fakes. */
export function isChatInputCommandInteraction(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const candidate = raw as {
    isChatInputCommand?: unknown;
    commandName?: unknown;
  };
  if (typeof candidate.isChatInputCommand === "function") {
    return interactionFlag(raw, "isChatInputCommand");
  }
  return typeof candidate.commandName === "string";
}

/**
 * Probe a discord.js-style `isX()` guard. Missing methods read as false;
 * throwing guards read as false. Never throws.
 */
export function interactionFlag(raw: unknown, method: string): boolean {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const fn = (raw as Record<string, unknown>)[method];
  if (typeof fn !== "function") {
    return false;
  }
  try {
    return (fn as () => unknown).call(raw) === true;
  } catch {
    return false;
  }
}

export function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) {
    throw new FrameworkError({
      code: "FRAMEWORK_ROUTE_NOT_FOUND",
      category: "Validation",
      message: "Received an interaction value that is not an object",
      context: { subsystem: "dispatch", event: "interaction.normalize" },
    });
  }
  return raw as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  return typeof value === "string" || value === null ? value : undefined;
}

function extractCommandName(raw: unknown): string {
  const record = asRecord(raw);
  const name = record.commandName;
  if (typeof name !== "string" || name.length === 0) {
    throw new FrameworkError({
      code: "FRAMEWORK_ROUTE_NOT_FOUND",
      category: "Validation",
      message: "Interaction did not carry a usable commandName",
      context: { subsystem: "dispatch", event: "interaction.normalize" },
      diagnostic: {
        likelyCause:
          "A non-command interaction reached command dispatch, or the interaction payload is malformed.",
        suggestedInvestigation: [
          "Component and modal interactions are handled by a separate router (Phase 3) — do not send them to command dispatch.",
          "If this came from discord.js, report the interaction shape as a possible framework bug.",
        ],
      },
    });
  }
  return name;
}

/** Best-effort id extraction shared by every interaction context. */
export function extractInteractionIds(raw: unknown): InteractionIds {
  if (typeof raw !== "object" || raw === null) {
    return {
      interactionId: undefined,
      guildId: undefined,
      channelId: undefined,
      userId: undefined,
    };
  }
  const record = raw as Record<string, unknown>;
  const userRecord =
    typeof record.user === "object" && record.user !== null
      ? (record.user as Record<string, unknown>)
      : undefined;
  return {
    interactionId: optionalString(record.id),
    guildId: optionalStringOrNull(record.guildId),
    channelId: optionalStringOrNull(record.channelId),
    userId:
      userRecord !== undefined ? optionalString(userRecord.id) : undefined,
  };
}

export function createCommandContext(
  init: CreateCommandContextInit,
): CommandContext {
  const commandName = extractCommandName(init.interaction);
  const requestId = init.requestId ?? randomUUID();
  const ids = extractInteractionIds(init.interaction);
  const replies = createReplyMethods({
    rawInteraction: init.interaction,
    label: commandName,
    requestId,
  });

  return {
    commandName,
    route: commandName,
    ...ids,
    requestId,
    logger: init.logger,
    services: init.services,
    options: init.options ?? {},
    interaction: init.interaction,
    client: init.client,
    reply: replies.reply,
    deferReply: replies.deferReply,
    followUp: replies.followUp,
    update: replies.update,
    deferUpdate: replies.deferUpdate,
  };
}
