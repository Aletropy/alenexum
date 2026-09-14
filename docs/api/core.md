---
title: "API: @alenexum/core"
description: Complete public reference for the core package — Bot, commands, contexts, middleware, guards, registries, services, config, logging, errors, loaders.
---

# API: `@alenexum/core`

Import from `@alenexum/core`. Public API is a contract — additive changes only (see [Versioning](../migration/versioning.md)). Internal helpers (`replies.ts` internals, `context.asRecord`) are not re-exported and not documented here.

## Bot

**Purpose:** Application root — lifecycle, registries, dispatch. Implements `PluginHost`.

```ts
import { Bot } from "@alenexum/core";
const bot = new Bot({ token });
```

| Member | Signature | Notes |
|---|---|---|
| `constructor` | `(options: BotOptions)` | Validates via `resolveConfig`. |
| `command` | `(def: CommandDefinition) => this` | Validates name + `execute` + `description`. |
| `component` / `modal` | `(def) => this` | `customId` routing; `type` enforced for components. |
| `autocomplete` | `(def: AutocompleteDefinition) => this` | Keyed `command\n option`. |
| `contextMenu` | `(def: ContextMenuDefinition) => this` | Keyed `type:name`. |
| `use` | `(mw: Middleware) => this` | Invalid middleware → `FRAMEWORK_INVALID_CONFIGURATION`. |
| `guard` | `(g: Guard) => this` | Normalized at registration. |
| `on` | `(event: BotLifecycleEvent, hook: LifecycleHook) => this` | `beforeStart`/`afterStart`/`beforeStop`/`afterStop`. |
| `attachConnector` | `(c: Connector) => this` | Once, before start; twice → `FRAMEWORK_INVALID_CONFIGURATION`. |
| `plugin` / `module` | `(p: Plugin / ModuleDefinition) => Promise<this>` | Shared namespace, order-enforced deps. |
| `start` / `stop` | `() => Promise<void>` | Hook + connector orchestration; `stop` drains up to `shutdownTimeoutMs`. |
| `handleInteraction` | `(raw: unknown, client?: unknown) => Promise<DispatchResult>` | Never throws. See [Routing](../fundamentals/routing-dispatch.md). |
| `getStatus` / `getCommandNames` / `getCommandDefinitions` / `getContextMenuDefinitions` / `getActiveDispatchCount` | getters | Introspection; active count for shutdown/health. |
| `services` / `logger` / `config` | properties | `ServiceContainer`, `FrameworkLogger`, `ResolvedBotConfig`. |

**Lifecycle:** `idle → starting → ready → stopping → stopped`. **Errors:** `INVALID_CONFIGURATION`, `LIFECYCLE_HOOK_FAILED`, `PLUGIN_INITIALIZATION_FAILED`, `CONNECTOR_START_FAILED`, `ROUTE_NOT_FOUND`, `COMMAND_HANDLER_FAILED`, `SHUTDOWN_TIMEOUT`. **When not to use:** never instantiate two `Bot`s sharing one connector; prefer one bot per process (shards = multiple processes via coordinator).

## Commands & options

`defineCommand(def)` — identity with literal + option-type inference. `CommandDefinition { name, description, options?, defaultMemberPermissions?, execute, middleware?, guards? }`. Name rule `COMMAND_NAME_PATTERN` (`/^[‌\p{Ll}\p{N}_-]{1,32}$/u`).

Builders: `stringOption`, `integerOption`, `numberOption`, `booleanOption`, `userOption`, `channelOption`, `roleOption`, `mentionableOption`, `attachmentOption` — each `{ type, description, required?, choices?, min/max…, autocomplete? }`. Inference: `InferOptionValues<TSchema>`, `InferSingleOption<O>` (choice literals, `required: true` narrowing, entity → `{ id }` / attachment → `{ id, url }`). Parsing: `parseOptions(raw, schema, { command, requestId }, { lenient? })` → `FRAMEWORK_COMMAND_VALIDATION_FAILED` on violations; `OptionResolverLike` is the structural discord.js resolver seam. `OptionValues = Record<string, unknown>`.

## Contexts

`BaseInteractionContext` (route, ids, `requestId`, `logger`, `services`, `interaction`, `client`) extended by `CommandContext<TOptions>`, `ComponentContext` (`customId`, `args`, `componentType`, `values`), `ModalContext` (`fields.get`), `AutocompleteContext` (`focused`, lenient `options`, `respond`), `ContextMenuContext` (`menuType`, `targetId/User/Message`). Factories: `createCommandContext`, `createComponentContext`, `createModalContext`, `createAutocompleteContext`, `createContextMenuContext`. Probes: `isChatInputCommandInteraction`, `isComponentInteraction`, `interactionFlag`, `extractInteractionIds`, `extractFocusedOption`, `detectComponentType`, `defineComponent`, `defineModal`, `defineAutocomplete`, `defineContextMenu`, `assertValidCommandName`, `assertValidContextMenuName`, `assertValidCustomId`.

Reply ack tracking (single flag; `followUp` exempt; double-ack → `FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED`): all five reply methods on command/component/modal/menu contexts; `respond(choices)` (≤ 25, validated) on autocomplete.

## Middleware, guards, permissions, cooldowns

`Middleware = (ctx, next) => void | Promise<void>`; `compose(mws)` builds the onion; double `next()` → `FRAMEWORK_MIDDLEWARE_FAILED`. `Guard = GuardObject { name, check } | GuardCheck`; `defineGuard`, `normalizeGuard` (bootstrap), `runGuards` (sequential, first deny wins, throwing check = bug); `DEFAULT_DENY_MESSAGE`. Factories: `requireGuild`, `requireUserPermissions`, `requireBotPermissions`, `requireRoles`, `requireUserIds` (all fail-closed, `{ message? }`). `cooldown({ durationMs, scope?, key?, message?, store?, now? })` + `MemoryCooldownStore(maxEntries?, now?)` + `CooldownStore` interface.

## Modules, plugins, services

`defineModule` / `definePlugin` (identity, literal names); `Plugin { name, version?, dependencies?, setup(host) }`, `ModuleDefinition` (same shape); `PluginHost` (command/component/modal/autocomplete/contextMenu/use/guard/on/services/logger); `claimUnitName`, `assertUnitDependencies`. `ServiceContainer { register, get, tryGet, has, keys }` (`SERVICE_ALREADY_REGISTERED`, `SERVICE_NOT_FOUND`).

## Config, logging, errors, instrumentation

`BotOptionsSchema`, `BotOptions` (input), `ResolvedBotConfig` (output), `resolveConfig`. `createLogger({ level?, pretty?, name?, destination? })`, `FrameworkLogger` (trace/debug/info/warn/error/fatal + `child`), `FrameworkLogBindings`, `FrameworkLogLevel`. `FrameworkError` (`code`, `category`, `context`, `diagnostic?`, `toJSON`), `FRAMEWORK_ERROR_CODES` (14), `FrameworkErrorCode/Category/Context/Init/Diagnostic`, `isFrameworkError`, `toFrameworkError`, `serializeError`, `formatFrameworkError`. Instrumentation: `TracerLike`, `SpanLike`, `StartSpanOptions`, `SpanStatusCode`, `SPAN_OK/ERROR/UNSET`, `DispatchObserver`, `DispatchObservation`, `DispatchKind`, `DispatchOutcome`. `Connector { name, start, stop }`.

## Registries & loaders

`Registry<T>` (base), `CommandRegistry` (`register`, `names`, `definitions`), `CustomIdRegistry<T>` (`registerCustomId`, `resolve` with exact-then-longest-prefix), `AutocompleteRegistry<T>` (`register`, `resolve`), `ContextMenuRegistry` (`key`, `registerDefinition`, `resolve`). Loaders (bootstrap only, sorted, fail-fast, `LoadReport`): `loadDefinitions` + `loadCommands/Components/Modals/Autocomplete/ContextMenus/Middleware/Guards/Plugins/Modules`; host types `SyncLoaderHost`, `PluginLoaderHost`, `ModuleLoaderHost`; `LoadOptions`, `LoadDefinitionsOptions`, `LoadedDefinition`.

Related: [Fundamentals](../fundamentals/application-lifecycle.md) · [Error codes](../reference/error-codes.md) · [Configuration](../reference/configuration.md).

## Export index

Every name re-exported by `packages/core/src/index.ts` (this list is verified by `pnpm docs:check`):

`AutocompleteChoice`, `AutocompleteContext`, `AutocompleteDefinition`, `CreateAutocompleteContextInit`, `createAutocompleteContext`, `defineAutocomplete`, `extractFocusedOption`, `FocusedOption`, `Bot`, `BotLifecycleEvent`, `BotStatus`, `DispatchFailure`, `DispatchResult`, `DispatchSuccess`, `LifecycleHook`, `assertValidCommandName`, `COMMAND_NAME_PATTERN`, `CommandDefinition`, `DefineCommandInput`, `defineCommand`, `ComponentContext`, `ComponentDefinition`, `ComponentType`, `CreateComponentContextInit`, `createComponentContext`, `defineComponent`, `detectComponentType`, `isComponentInteraction`, `BotOptions`, `BotOptionsSchema`, `ResolvedBotConfig`, `resolveConfig`, `Connector`, `BaseInteractionContext`, `CommandContext`, `CreateCommandContextInit`, `createCommandContext`, `extractInteractionIds`, `InteractionIds`, `interactionFlag`, `isChatInputCommandInteraction`, `assertValidContextMenuName`, `ContextMenuContext`, `ContextMenuDefinition`, `ContextMenuRegistry`, `ContextMenuType`, `CreateContextMenuContextInit`, `createContextMenuContext`, `defineContextMenu`, `CooldownOptions`, `CooldownScope`, `CooldownStore`, `cooldown`, `MemoryCooldownStore`, `FRAMEWORK_ERROR_CODES`, `FrameworkDiagnostic`, `FrameworkError`, `FrameworkErrorCategory`, `FrameworkErrorCode`, `FrameworkErrorContext`, `FrameworkErrorInit`, `formatFrameworkError`, `isFrameworkError`, `serializeError`, `toFrameworkError`, `DEFAULT_DENY_MESSAGE`, `defineGuard`, `Guard`, `GuardCheck`, `GuardDecision`, `GuardObject`, `GuardResult`, `NormalizedGuard`, `normalizeGuard`, `runGuards`, `DispatchKind`, `DispatchObservation`, `DispatchObserver`, `DispatchOutcome`, `SPAN_ERROR`, `SPAN_OK`, `SPAN_UNSET`, `SpanAttributeValue`, `SpanLike`, `SpanStatusCode`, `StartSpanOptions`, `TracerLike`, `LoadDefinitionsOptions`, `LoadedDefinition`, `LoadOptions`, `LoadReport`, `loadAutocomplete`, `loadCommands`, `loadComponents`, `loadContextMenus`, `loadDefinitions`, `loadGuards`, `loadMiddleware`, `loadModals`, `loadModules`, `loadPlugins`, `ModuleLoaderHost`, `PluginLoaderHost`, `SyncLoaderHost`, `CreateLoggerOptions`, `createLogger`, `FrameworkLogBindings`, `FrameworkLogger`, `FrameworkLogLevel`, `CommandHandler`, `compose`, `Middleware`, `CreateModalContextInit`, `createModalContext`, `defineModal`, `ModalContext`, `ModalDefinition`, `ModalFields`, `defineModule`, `ModuleDefinition`, `AttachmentOption`, `attachmentOption`, `BooleanOption`, `booleanOption`, `ChannelOption`, `Choice`, `CommandOptionsMap`, `channelOption`, `InferOptionValues`, `InferSingleOption`, `IntegerOption`, `integerOption`, `MentionableOption`, `mentionableOption`, `NumberOption`, `numberOption`, `OptionDefinition`, `OptionResolverLike`, `OptionValues`, `parseOptions`, `ResolvedAttachment`, `ResolvedChannel`, `ResolvedMentionable`, `ResolvedRole`, `ResolvedUser`, `RoleOption`, `roleOption`, `StringOption`, `stringOption`, `UserOption`, `userOption`, `PermissionGuardOptions`, `requireBotPermissions`, `requireGuild`, `requireRoles`, `requireUserIds`, `requireUserPermissions`, `Plugin`, `PluginHost`, `assertUnitDependencies`, `claimUnitName`, `definePlugin`, `AutocompleteRegistry`, `assertValidCustomId`, `CommandRegistry`, `CustomIdRegistry`, `Registry`, `ServiceContainer`, `ServiceKey`.
