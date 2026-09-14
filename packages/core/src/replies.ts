import { FrameworkError } from "./errors.js";

/**
 * Acknowledgement-tracked reply surface shared by command, component, modal,
 * and context-menu contexts. Discord rejects double-acks, so the second
 * ack attempt fails fast with `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED`
 * instead of surfacing a raw API error. Only methods present on the raw
 * interaction are wired; calling an absent one throws a classified error.
 */
export interface ReplyMethods {
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
  update(message: string): Promise<void>;
  deferUpdate(): Promise<void>;
}

export interface ReplyMethodsInit {
  rawInteraction: unknown;
  /** Human label for errors (command name or customId). */
  label: string;
  requestId: string;
  /** reply() is mandatory; everything else is wired when present. */
  requireReply?: boolean;
}

function alreadyAcknowledgedError(
  label: string,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
    category: "DiscordAPI",
    message: `Interaction "${label}" was already acknowledged`,
    context: {
      subsystem: "dispatch",
      event: "interaction.reply",
      command: label,
      requestId,
    },
    diagnostic: {
      likelyCause:
        "An ack method (reply/deferReply/update/deferUpdate) was called twice for the same interaction.",
      suggestedInvestigation: [
        "Check that only one ack path runs per interaction.",
        "Look for retried dispatches sharing the same interactionId/requestId in the logs.",
      ],
    },
  });
}

function unsupportedError(
  label: string,
  method: string,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INTERNAL",
    category: "Internal",
    message: `Interaction "${label}" does not support ${method}()`,
    context: {
      subsystem: "dispatch",
      event: "interaction.normalize",
      command: label,
      requestId,
    },
  });
}

export function createReplyMethods(init: ReplyMethodsInit): ReplyMethods {
  const { rawInteraction, label, requestId } = init;
  const requireReply = init.requireReply ?? true;
  if (typeof rawInteraction !== "object" || rawInteraction === null) {
    throw new FrameworkError({
      code: "FRAMEWORK_ROUTE_NOT_FOUND",
      category: "Validation",
      message: "Received an interaction value that is not an object",
      context: { subsystem: "dispatch", event: "interaction.normalize" },
    });
  }
  const record = rawInteraction as Record<string, unknown>;
  const rawReply = record.reply;
  if (requireReply && typeof rawReply !== "function") {
    throw unsupportedError(label, "reply", requestId);
  }

  let acknowledged = false;
  const guard = (): void => {
    if (acknowledged) {
      throw alreadyAcknowledgedError(label, requestId);
    }
    acknowledged = true;
  };
  const callOptional = async (
    method: string,
    arg: string | undefined,
  ): Promise<void> => {
    const fn = record[method];
    if (typeof fn !== "function") {
      throw unsupportedError(label, method, requestId);
    }
    if (arg === undefined) {
      await (fn as () => Promise<unknown>).call(rawInteraction);
    } else {
      await (fn as (message: string) => Promise<unknown>).call(
        rawInteraction,
        arg,
      );
    }
  };

  return {
    reply: async (message: string): Promise<void> => {
      guard();
      await callOptional("reply", message);
    },
    deferReply: async (): Promise<void> => {
      guard();
      await callOptional("deferReply", undefined);
    },
    followUp: async (message: string): Promise<void> => {
      await callOptional("followUp", message);
    },
    update: async (message: string): Promise<void> => {
      guard();
      await callOptional("update", message);
    },
    deferUpdate: async (): Promise<void> => {
      guard();
      await callOptional("deferUpdate", undefined);
    },
  };
}
