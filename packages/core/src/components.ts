import { randomUUID } from "node:crypto";
import {
  type BaseInteractionContext,
  extractInteractionIds,
  interactionFlag,
} from "./context.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import { createReplyMethods } from "./replies.js";
import type { ServiceContainer } from "./services.js";

/**
 * Message-component interactions (buttons, select menus).
 *
 * discord.js owns the builders and collectors; the framework owns routing:
 * definitions register a `customId`, matched exactly or by `:`-separated
 * prefix (trailing segments arrive as `ctx.args`). Dynamic payloads stay in
 * the customId — no per-request parsing beyond a bounded segment split.
 */

export type ComponentType =
  | "button"
  | "stringSelect"
  | "userSelect"
  | "roleSelect"
  | "mentionableSelect"
  | "channelSelect";

export interface ComponentContext extends BaseInteractionContext {
  /** Full customId as sent by Discord. */
  readonly customId: string;
  /** Trailing `:`-separated segments when matched by prefix. */
  readonly args: readonly string[];
  /** Detected interaction kind (button, stringSelect, …). */
  readonly componentType: string;
  /** Selected values for select menus ( snowflake ids for entity selects). */
  readonly values: readonly string[];
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
  update(message: string): Promise<void>;
  deferUpdate(): Promise<void>;
}

export interface ComponentDefinition {
  readonly customId: string;
  /** Enforced when present: a button handler never serves a select. */
  readonly type?: ComponentType | undefined;
  execute(ctx: ComponentContext): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

export function defineComponent<const T extends ComponentDefinition>(
  definition: T,
): T {
  return definition;
}

export interface CreateComponentContextInit {
  interaction: unknown;
  customId: string;
  args: readonly string[];
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
}

/** Detect the component kind via discord.js-style guards. Never throws. */
export function detectComponentType(raw: unknown): string {
  if (interactionFlag(raw, "isButton")) {
    return "button";
  }
  if (interactionFlag(raw, "isStringSelectMenu")) {
    return "stringSelect";
  }
  if (interactionFlag(raw, "isUserSelectMenu")) {
    return "userSelect";
  }
  if (interactionFlag(raw, "isRoleSelectMenu")) {
    return "roleSelect";
  }
  if (interactionFlag(raw, "isMentionableSelectMenu")) {
    return "mentionableSelect";
  }
  if (interactionFlag(raw, "isChannelSelectMenu")) {
    return "channelSelect";
  }
  if (interactionFlag(raw, "isAnySelectMenu")) {
    return "select";
  }
  return "unknown";
}

/** True for any discord.js component interaction (button or select menu). */
export function isComponentInteraction(raw: unknown): boolean {
  return detectComponentType(raw) !== "unknown";
}

export function createComponentContext(
  init: CreateComponentContextInit,
): ComponentContext {
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
    componentType: detectComponentType(init.interaction),
    values: extractValues(init.interaction),
    reply: replies.reply,
    deferReply: replies.deferReply,
    followUp: replies.followUp,
    update: replies.update,
    deferUpdate: replies.deferUpdate,
  };
}

function extractValues(raw: unknown): readonly string[] {
  if (typeof raw !== "object" || raw === null) {
    return [];
  }
  const values = (raw as { values?: unknown }).values;
  if (
    Array.isArray(values) &&
    values.every((value) => typeof value === "string")
  ) {
    return values as string[];
  }
  return [];
}
