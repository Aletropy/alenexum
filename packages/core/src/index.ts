/**
 * `@discord-framework/core` — application architecture for Discord bots.
 *
 * discord.js owns the network (Gateway, REST, caches, builders). This package
 * owns lifecycle, routing, middleware, registries, config, logging, and
 * diagnostics. Public API is a contract: additive changes only.
 */

export {
  Bot,
  type BotLifecycleEvent,
  type BotStatus,
  type DispatchFailure,
  type DispatchResult,
  type DispatchSuccess,
  type LifecycleHook,
} from "./bot.js";
export {
  assertValidCommandName,
  COMMAND_NAME_PATTERN,
  type CommandDefinition,
  defineCommand,
} from "./command.js";

export {
  type BotOptions,
  BotOptionsSchema,
  type ResolvedBotConfig,
  resolveConfig,
} from "./config.js";
export type { Connector } from "./connector.js";
export {
  type CommandContext,
  type CreateCommandContextInit,
  createCommandContext,
  isChatInputCommandInteraction,
} from "./context.js";
export {
  FRAMEWORK_ERROR_CODES,
  type FrameworkDiagnostic,
  FrameworkError,
  type FrameworkErrorCategory,
  type FrameworkErrorCode,
  type FrameworkErrorContext,
  type FrameworkErrorInit,
  isFrameworkError,
  serializeError,
  toFrameworkError,
} from "./errors.js";
export {
  type CreateLoggerOptions,
  createLogger,
  type FrameworkLogBindings,
  type FrameworkLogger,
  type FrameworkLogLevel,
} from "./logger.js";
export { type CommandHandler, compose, type Middleware } from "./middleware.js";
export type { Plugin, PluginHost } from "./plugin.js";
export { CommandRegistry } from "./registry.js";
export { ServiceContainer, type ServiceKey } from "./services.js";
