import { randomUUID } from "node:crypto";
import { FrameworkError } from "./errors.js";
import type { FrameworkLogger } from "./logger.js";
import type { ServiceContainer } from "./services.js";

/**
 * Handler-facing context. Common tasks (reply, logging, services) are
 * first-class; the raw discord.js interaction/client stay reachable via the
 * `interaction` / `client` escape hatches so users never wait on a wrapper.
 */
export interface CommandContext {
  readonly commandName: string;
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
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
}

export interface CreateCommandContextInit {
  interaction: unknown;
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
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
    try {
      return (candidate.isChatInputCommand as () => unknown)() === true;
    } catch {
      return false;
    }
  }
  return typeof candidate.commandName === "string";
}

function asRecord(raw: unknown): Record<string, unknown> {
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

function alreadyAcknowledgedError(
  commandName: string,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
    category: "DiscordAPI",
    message: `Interaction for command "${commandName}" was already acknowledged`,
    context: {
      subsystem: "dispatch",
      event: "interaction.reply",
      command: commandName,
      requestId,
    },
    diagnostic: {
      likelyCause:
        "reply() or deferReply() was called twice for the same interaction (duplicate handler execution or a double-ack bug).",
      suggestedInvestigation: [
        "Check that only one reply/defer path runs per command execution.",
        "Look for retried dispatches sharing the same interactionId/requestId in the logs.",
      ],
    },
  });
}

export function createCommandContext(
  init: CreateCommandContextInit,
): CommandContext {
  const commandName = extractCommandName(init.interaction);
  const record = asRecord(init.interaction);
  const requestId = init.requestId ?? randomUUID();

  const replyFn = record.reply;
  const deferFn = record.deferReply;
  const followUpFn = record.followUp;
  if (typeof replyFn !== "function") {
    throw new FrameworkError({
      code: "FRAMEWORK_INTERNAL",
      category: "Internal",
      message: `Interaction for command "${commandName}" does not support reply()`,
      context: {
        subsystem: "dispatch",
        event: "interaction.normalize",
        command: commandName,
        requestId,
      },
    });
  }

  const userRecord =
    typeof record.user === "object" && record.user !== null
      ? (record.user as Record<string, unknown>)
      : undefined;

  // Local ack tracking: Discord rejects double-acks, so fail fast with a
  // classified error instead of surfacing a raw API failure.
  let acknowledged = false;

  return {
    commandName,
    interactionId: optionalString(record.id),
    guildId: optionalStringOrNull(record.guildId),
    channelId: optionalStringOrNull(record.channelId),
    userId:
      userRecord !== undefined ? optionalString(userRecord.id) : undefined,
    requestId,
    logger: init.logger,
    services: init.services,
    interaction: init.interaction,
    client: init.client,
    reply: async (message: string): Promise<void> => {
      if (acknowledged) {
        throw alreadyAcknowledgedError(commandName, requestId);
      }
      acknowledged = true;
      await (replyFn as (message: string) => Promise<unknown>).call(
        init.interaction,
        message,
      );
    },
    deferReply: async (): Promise<void> => {
      if (acknowledged) {
        throw alreadyAcknowledgedError(commandName, requestId);
      }
      acknowledged = true;
      if (typeof deferFn === "function") {
        await (deferFn as () => Promise<unknown>).call(init.interaction);
      }
    },
    followUp: async (message: string): Promise<void> => {
      if (typeof followUpFn === "function") {
        await (followUpFn as (message: string) => Promise<unknown>).call(
          init.interaction,
          message,
        );
      }
    },
  };
}
