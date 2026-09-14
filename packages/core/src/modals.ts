import { randomUUID } from "node:crypto";
import {
  type BaseInteractionContext,
  extractInteractionIds,
} from "./context.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import { createReplyMethods } from "./replies.js";
import type { ServiceContainer } from "./services.js";

/**
 * Modal-submit interactions. Routing reuses the customId prefix convention
 * from components; submitted text inputs arrive as `ctx.fields`.
 */
export interface ModalFields {
  /** Submitted value for a text input, or undefined when absent. */
  get(name: string): string | undefined;
}

export interface ModalContext extends BaseInteractionContext {
  readonly customId: string;
  readonly args: readonly string[];
  readonly fields: ModalFields;
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
  update(message: string): Promise<void>;
  deferUpdate(): Promise<void>;
}

export interface ModalDefinition {
  readonly customId: string;
  execute(ctx: ModalContext): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

export function defineModal<const T extends ModalDefinition>(definition: T): T {
  return definition;
}

export interface CreateModalContextInit {
  interaction: unknown;
  customId: string;
  args: readonly string[];
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
}

export function createModalContext(init: CreateModalContextInit): ModalContext {
  const requestId = init.requestId ?? randomUUID();
  const ids = extractInteractionIds(init.interaction);
  const replies = createReplyMethods({
    rawInteraction: init.interaction,
    label: init.customId,
    requestId,
  });
  return {
    ...ids,
    route: init.customId,
    requestId,
    logger: init.logger,
    services: init.services,
    interaction: init.interaction,
    client: init.client,
    customId: init.customId,
    args: init.args,
    fields: createModalFields(init.interaction),
    reply: replies.reply,
    deferReply: replies.deferReply,
    followUp: replies.followUp,
    update: replies.update,
    deferUpdate: replies.deferUpdate,
  };
}

function createModalFields(raw: unknown): ModalFields {
  return {
    get(name: string): string | undefined {
      if (typeof raw !== "object" || raw === null) {
        return undefined;
      }
      const fields = (raw as { fields?: unknown }).fields;
      if (typeof fields !== "object" || fields === null) {
        return undefined;
      }
      const getter = (fields as { getTextInputValue?: unknown })
        .getTextInputValue;
      if (typeof getter !== "function") {
        return undefined;
      }
      try {
        const value = (getter as (id: string) => unknown).call(fields, name);
        return typeof value === "string" ? value : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
