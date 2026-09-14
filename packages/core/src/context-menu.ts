import { randomUUID } from "node:crypto";
import {
  type BaseInteractionContext,
  extractInteractionIds,
  interactionFlag,
} from "./context.js";
import { FrameworkError } from "./errors.js";
import type { Guard } from "./guards.js";
import type { FrameworkLogger } from "./logger.js";
import type { Middleware } from "./middleware.js";
import { Registry } from "./registry.js";
import { createReplyMethods } from "./replies.js";
import type { ServiceContainer } from "./services.js";

/**
 * Context-menu commands (user / message). Unlike slash commands, names may
 * contain capitals and spaces (`"Get avatar"`), so they validate against
 * their own rule (1–32 chars) rather than the slash-command pattern.
 */
export type ContextMenuType = "user" | "message";

export interface ContextMenuContext extends BaseInteractionContext {
  readonly commandName: string;
  readonly menuType: ContextMenuType;
  readonly targetId: string | undefined;
  /** Raw discord.js user for `user` commands (escape hatch). */
  readonly targetUser: unknown;
  /** Raw discord.js message for `message` commands (escape hatch). */
  readonly targetMessage: unknown;
  reply(message: string): Promise<void>;
  deferReply(): Promise<void>;
  followUp(message: string): Promise<void>;
  update(message: string): Promise<void>;
  deferUpdate(): Promise<void>;
}

export interface ContextMenuDefinition {
  readonly type: ContextMenuType;
  readonly name: string;
  /**
   * Discord permission bitfield serialized as a string (client-side gating;
   * runtime enforcement still belongs to guards). Deployed verbatim.
   */
  readonly defaultMemberPermissions?: string | null | undefined;
  execute(ctx: ContextMenuContext): void | Promise<void>;
  readonly middleware?: readonly Middleware[];
  readonly guards?: readonly Guard[] | undefined;
}

export function defineContextMenu<const T extends ContextMenuDefinition>(
  definition: T,
): T {
  return definition;
}

export function assertValidContextMenuName(name: string): void {
  if (typeof name !== "string" || name.length === 0 || name.length > 32) {
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid context-menu name "${name}": must be 1-32 characters`,
      context: {
        subsystem: "registry",
        event: "contextmenu.validate",
        command: name,
      },
    });
  }
}

/** Registry keyed by `type:name` (user and message commands may share names). */
export class ContextMenuRegistry extends Registry<ContextMenuDefinition> {
  static key(type: ContextMenuType, name: string): string {
    return `${type}:${name}`;
  }

  registerDefinition(definition: ContextMenuDefinition): void {
    assertValidContextMenuName(definition.name);
    if (typeof definition.execute !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: `Context-menu command "${definition.name}" must define an execute() function`,
        context: {
          subsystem: "registry",
          event: "contextmenu.register",
          command: definition.name,
        },
      });
    }
    this.store(
      ContextMenuRegistry.key(definition.type, definition.name),
      definition,
      () => duplicateError(definition),
    );
  }

  resolve(
    type: ContextMenuType,
    name: string,
  ): ContextMenuDefinition | undefined {
    return this.entries.get(ContextMenuRegistry.key(type, name));
  }
}

function duplicateError(definition: ContextMenuDefinition): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_INVALID_CONFIGURATION",
    category: "Config",
    message: `Duplicate ${definition.type} context-menu registration: "${definition.name}"`,
    context: {
      subsystem: "registry",
      event: "contextmenu.register",
      command: definition.name,
    },
  });
}

export interface CreateContextMenuContextInit {
  interaction: unknown;
  definition: ContextMenuDefinition;
  client?: unknown;
  logger: FrameworkLogger;
  services: ServiceContainer;
  requestId?: string;
}

export function createContextMenuContext(
  init: CreateContextMenuContextInit,
): ContextMenuContext {
  const requestId = init.requestId ?? randomUUID();
  const ids = extractInteractionIds(init.interaction);
  const replies = createReplyMethods({
    rawInteraction: init.interaction,
    label: init.definition.name,
    requestId,
  });
  const record =
    typeof init.interaction === "object" && init.interaction !== null
      ? (init.interaction as Record<string, unknown>)
      : {};
  const targetId =
    typeof record.targetId === "string" ? record.targetId : undefined;
  return {
    ...ids,
    route: init.definition.name,
    requestId,
    logger: init.logger,
    services: init.services,
    interaction: init.interaction,
    client: init.client,
    commandName: init.definition.name,
    menuType: detectMenuType(init.interaction, init.definition.type),
    targetId,
    targetUser: record.targetUser,
    targetMessage: record.targetMessage,
    reply: replies.reply,
    deferReply: replies.deferReply,
    followUp: replies.followUp,
    update: replies.update,
    deferUpdate: replies.deferUpdate,
  };
}

function detectMenuType(
  raw: unknown,
  fallback: ContextMenuType,
): ContextMenuType {
  if (interactionFlag(raw, "isUserContextMenuCommand")) {
    return "user";
  }
  if (interactionFlag(raw, "isMessageContextMenuCommand")) {
    return "message";
  }
  return fallback;
}
