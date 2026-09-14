/**
 * `@nexum/core` — application architecture for Discord bots.
 *
 * discord.js owns the network (Gateway, REST, caches, builders). This package
 * owns lifecycle, routing, middleware, registries, config, logging, and
 * diagnostics. Public API is a contract: additive changes only.
 */

export {
  type AutocompleteChoice,
  type AutocompleteContext,
  type AutocompleteDefinition,
  type CreateAutocompleteContextInit,
  createAutocompleteContext,
  defineAutocomplete,
  extractFocusedOption,
  type FocusedOption,
} from "./autocomplete.js";
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
  type DefineCommandInput,
  defineCommand,
} from "./command.js";
export {
  type ComponentContext,
  type ComponentDefinition,
  type ComponentType,
  type CreateComponentContextInit,
  createComponentContext,
  defineComponent,
  detectComponentType,
  isComponentInteraction,
} from "./components.js";
export {
  type BotOptions,
  BotOptionsSchema,
  type ResolvedBotConfig,
  resolveConfig,
} from "./config.js";
export type { Connector } from "./connector.js";
export {
  type BaseInteractionContext,
  type CommandContext,
  type CreateCommandContextInit,
  createCommandContext,
  extractInteractionIds,
  type InteractionIds,
  interactionFlag,
  isChatInputCommandInteraction,
} from "./context.js";
export {
  assertValidContextMenuName,
  type ContextMenuContext,
  type ContextMenuDefinition,
  ContextMenuRegistry,
  type ContextMenuType,
  type CreateContextMenuContextInit,
  createContextMenuContext,
  defineContextMenu,
} from "./context-menu.js";
export {
  type CooldownOptions,
  type CooldownScope,
  type CooldownStore,
  cooldown,
  MemoryCooldownStore,
} from "./cooldown.js";
export {
  FRAMEWORK_ERROR_CODES,
  type FrameworkDiagnostic,
  FrameworkError,
  type FrameworkErrorCategory,
  type FrameworkErrorCode,
  type FrameworkErrorContext,
  type FrameworkErrorInit,
  formatFrameworkError,
  isFrameworkError,
  serializeError,
  toFrameworkError,
} from "./errors.js";
export {
  DEFAULT_DENY_MESSAGE,
  defineGuard,
  type Guard,
  type GuardCheck,
  type GuardDecision,
  type GuardObject,
  type GuardResult,
  type NormalizedGuard,
  normalizeGuard,
  runGuards,
} from "./guards.js";
export {
  type DispatchKind,
  type DispatchObservation,
  type DispatchObserver,
  type DispatchOutcome,
  SPAN_ERROR,
  SPAN_OK,
  SPAN_UNSET,
  type SpanAttributeValue,
  type SpanLike,
  type SpanStatusCode,
  type StartSpanOptions,
  type TracerLike,
} from "./instrumentation.js";
export {
  type LoadDefinitionsOptions,
  type LoadedDefinition,
  type LoadOptions,
  type LoadReport,
  loadAutocomplete,
  loadCommands,
  loadComponents,
  loadContextMenus,
  loadDefinitions,
  loadGuards,
  loadMiddleware,
  loadModals,
  loadModules,
  loadPlugins,
  type ModuleLoaderHost,
  type PluginLoaderHost,
  type SyncLoaderHost,
} from "./loader.js";
export {
  type CreateLoggerOptions,
  createLogger,
  type FrameworkLogBindings,
  type FrameworkLogger,
  type FrameworkLogLevel,
} from "./logger.js";
export { type CommandHandler, compose, type Middleware } from "./middleware.js";
export {
  type CreateModalContextInit,
  createModalContext,
  defineModal,
  type ModalContext,
  type ModalDefinition,
  type ModalFields,
} from "./modals.js";
export { defineModule, type ModuleDefinition } from "./modules.js";
export {
  type AttachmentOption,
  attachmentOption,
  type BooleanOption,
  booleanOption,
  type ChannelOption,
  type Choice,
  type CommandOptionsMap,
  channelOption,
  type InferOptionValues,
  type InferSingleOption,
  type IntegerOption,
  integerOption,
  type MentionableOption,
  mentionableOption,
  type NumberOption,
  numberOption,
  type OptionDefinition,
  type OptionResolverLike,
  type OptionValues,
  parseOptions,
  type ResolvedAttachment,
  type ResolvedChannel,
  type ResolvedMentionable,
  type ResolvedRole,
  type ResolvedUser,
  type RoleOption,
  roleOption,
  type StringOption,
  stringOption,
  type UserOption,
  userOption,
} from "./options.js";
export {
  type PermissionGuardOptions,
  requireBotPermissions,
  requireGuild,
  requireRoles,
  requireUserIds,
  requireUserPermissions,
} from "./permissions.js";
export type { Plugin, PluginHost } from "./plugin.js";
export {
  assertUnitDependencies,
  claimUnitName,
  definePlugin,
} from "./plugin.js";
export {
  AutocompleteRegistry,
  assertValidCustomId,
  CommandRegistry,
  CustomIdRegistry,
  Registry,
} from "./registry.js";
export { ServiceContainer, type ServiceKey } from "./services.js";
