import { randomUUID } from "node:crypto";
import {
  type AutocompleteContext,
  type AutocompleteDefinition,
  createAutocompleteContext,
  extractFocusedOption,
} from "./autocomplete.js";
import type { CommandDefinition } from "./command.js";
import {
  type ComponentContext,
  type ComponentDefinition,
  createComponentContext,
  detectComponentType,
  isComponentInteraction,
} from "./components.js";
import {
  type BotOptions,
  type ResolvedBotConfig,
  resolveConfig,
} from "./config.js";
import type { Connector } from "./connector.js";
import {
  type BaseInteractionContext,
  type CommandContext,
  createCommandContext,
  extractInteractionIds,
  interactionFlag,
  isChatInputCommandInteraction,
} from "./context.js";
import {
  type ContextMenuContext,
  type ContextMenuDefinition,
  ContextMenuRegistry,
  type ContextMenuType,
  createContextMenuContext,
} from "./context-menu.js";
import {
  FrameworkError,
  isFrameworkError,
  serializeError,
  toFrameworkError,
} from "./errors.js";
import {
  DEFAULT_DENY_MESSAGE,
  type Guard,
  type GuardDecision,
  type NormalizedGuard,
  normalizeGuard,
  runGuards,
} from "./guards.js";
import { createLogger, type FrameworkLogger } from "./logger.js";
import { compose, type Middleware } from "./middleware.js";
import {
  createModalContext,
  type ModalContext,
  type ModalDefinition,
} from "./modals.js";
import type { ModuleDefinition } from "./modules.js";
import { parseOptions } from "./options.js";
import {
  assertUnitDependencies,
  claimUnitName,
  type Plugin,
  type PluginHost,
} from "./plugin.js";
import {
  AutocompleteRegistry,
  CommandRegistry,
  CustomIdRegistry,
} from "./registry.js";
import { ServiceContainer } from "./services.js";

export type BotLifecycleEvent =
  | "beforeStart"
  | "afterStart"
  | "beforeStop"
  | "afterStop";
export type LifecycleHook = () => void | Promise<void>;
export type BotStatus = "idle" | "starting" | "ready" | "stopping" | "stopped";

export interface DispatchSuccess {
  readonly ok: true;
  /** Route key: command name, customId, or menu name. */
  readonly command: string;
  readonly durationMs: number;
  readonly requestId: string;
}

export interface DispatchFailure {
  readonly ok: false;
  readonly error: FrameworkError;
  readonly durationMs: number;
  readonly requestId: string;
}

export type DispatchResult = DispatchSuccess | DispatchFailure;

/**
 * Application root. Owns lifecycle, interaction registries, middleware, and
 * dispatch for every Discord interaction type (slash commands, components,
 * modals, autocomplete, context menus). Network transport is injected via a
 * {@link Connector} so core never depends on discord.js.
 */
export class Bot implements PluginHost {
  readonly config: ResolvedBotConfig;
  readonly logger: FrameworkLogger;
  readonly services = new ServiceContainer();

  private readonly registry = new CommandRegistry();
  private readonly components = new CustomIdRegistry<ComponentDefinition>();
  private readonly modals = new CustomIdRegistry<ModalDefinition>();
  private readonly autocompletes =
    new AutocompleteRegistry<AutocompleteDefinition>();
  private readonly contextMenus = new ContextMenuRegistry();
  private readonly globalMiddleware: Middleware[] = [];
  private readonly globalGuards: NormalizedGuard[] = [];
  /** Named composition units (plugins + modules share one namespace). */
  private readonly units = new Map<string, string>();
  /**
   * Normalized per-definition guards, keyed by definition identity.
   * Normalized once at registration; dispatch does a single lookup.
   */
  private readonly guardLists = new WeakMap<
    object,
    readonly NormalizedGuard[]
  >();
  private readonly hooks: Record<BotLifecycleEvent, LifecycleHook[]> = {
    beforeStart: [],
    afterStart: [],
    beforeStop: [],
    afterStop: [],
  };
  private connector: Connector | undefined;
  private status: BotStatus = "idle";

  constructor(options: BotOptions) {
    const config = resolveConfig(options);
    this.config = config;
    this.logger = config.logger ?? createLogger();
    this.connector = config.connector;
  }

  // -- registration (bootstrap) -------------------------------------------

  command(definition: CommandDefinition): this {
    this.registry.register(definition);
    this.cacheGuards(definition, definition.guards, "bot.command()");
    this.logger.debug(
      {
        subsystem: "registry",
        event: "command.registered",
        command: definition.name,
      },
      `Registered command "${definition.name}"`,
    );
    return this;
  }

  component(definition: ComponentDefinition): this {
    this.components.registerCustomId(definition, {
      kind: "component",
      registerEvent: "component.register",
      registerCall: "bot.component()",
    });
    this.cacheGuards(definition, definition.guards, "bot.component()");
    this.logger.debug(
      {
        subsystem: "registry",
        event: "component.registered",
        command: definition.customId,
      },
      `Registered component "${definition.customId}"`,
    );
    return this;
  }

  modal(definition: ModalDefinition): this {
    this.modals.registerCustomId(definition, {
      kind: "modal",
      registerEvent: "modal.register",
      registerCall: "bot.modal()",
    });
    this.cacheGuards(definition, definition.guards, "bot.modal()");
    this.logger.debug(
      {
        subsystem: "registry",
        event: "modal.registered",
        command: definition.customId,
      },
      `Registered modal "${definition.customId}"`,
    );
    return this;
  }

  autocomplete(definition: AutocompleteDefinition): this {
    this.autocompletes.register(
      definition.command,
      definition.option,
      definition,
      "bot.autocomplete()",
    );
    this.cacheGuards(definition, definition.guards, "bot.autocomplete()");
    this.logger.debug(
      {
        subsystem: "registry",
        event: "autocomplete.registered",
        command: definition.command,
      },
      `Registered autocomplete for "${describeAutocompleteTarget(definition)}"`,
    );
    return this;
  }

  contextMenu(definition: ContextMenuDefinition): this {
    this.contextMenus.registerDefinition(definition);
    this.cacheGuards(definition, definition.guards, "bot.contextMenu()");
    this.logger.debug(
      {
        subsystem: "registry",
        event: "contextmenu.registered",
        command: definition.name,
      },
      `Registered ${definition.type} context-menu "${definition.name}"`,
    );
    return this;
  }

  /** Normalize once here; dispatch only looks the list up. */
  private cacheGuards(
    definition: object,
    guards: readonly Guard[] | undefined,
    registerCall: string,
  ): void {
    this.guardLists.set(
      definition,
      (guards ?? []).map((guard) => normalizeGuard(guard, registerCall)),
    );
  }

  private guardsFor(definition: object): readonly NormalizedGuard[] {
    return this.guardLists.get(definition) ?? [];
  }

  use(middleware: Middleware): this {
    if (typeof middleware !== "function") {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: "Middleware must be a function",
        context: { subsystem: "middleware", event: "middleware.register" },
      });
    }
    this.globalMiddleware.push(middleware);
    return this;
  }

  on(event: BotLifecycleEvent, hook: LifecycleHook): this {
    this.hooks[event].push(hook);
    return this;
  }

  guard(guard: Guard): this {
    this.globalGuards.push(normalizeGuard(guard, "bot.guard()"));
    return this;
  }

  attachConnector(connector: Connector): this {
    if (this.connector !== undefined) {
      throw new FrameworkError({
        code: "FRAMEWORK_INVALID_CONFIGURATION",
        category: "Config",
        message: "A connector is already attached to this bot",
        context: { subsystem: "lifecycle", event: "connector.attach" },
      });
    }
    if (this.status !== "idle" && this.status !== "stopped") {
      throw new FrameworkError({
        code: "FRAMEWORK_LIFECYCLE_HOOK_FAILED",
        category: "Framework",
        message: "Cannot attach a connector while the bot is running",
        context: { subsystem: "lifecycle", event: "connector.attach" },
      });
    }
    this.connector = connector;
    return this;
  }

  async plugin(plugin: Plugin): Promise<this> {
    await this.runUnit("plugin", plugin);
    return this;
  }

  async module(definition: ModuleDefinition): Promise<this> {
    await this.runUnit("module", definition);
    return this;
  }

  /**
   * Host facade handed to plugins and modules: the full registration
   * surface with a logger already tagged (`plugin`/`module` binding).
   */
  private hostFor(kind: "plugin" | "module", name: string): PluginHost {
    const logger =
      kind === "plugin"
        ? this.logger.child({ plugin: name })
        : this.logger.child({ module: name });
    return {
      command: (definition) => {
        this.command(definition);
      },
      component: (definition) => {
        this.component(definition);
      },
      modal: (definition) => {
        this.modal(definition);
      },
      autocomplete: (definition) => {
        this.autocomplete(definition);
      },
      contextMenu: (definition) => {
        this.contextMenu(definition);
      },
      use: (middleware) => {
        this.use(middleware);
      },
      guard: (guard) => {
        this.guard(guard);
      },
      on: (event, hook) => {
        this.on(event, hook);
      },
      services: this.services,
      logger,
    };
  }

  private async runUnit(
    kind: "plugin" | "module",
    unit: {
      readonly name: string;
      readonly version?: string | undefined;
      readonly dependencies?: readonly string[] | undefined;
      setup(host: PluginHost): void | Promise<void>;
    },
  ): Promise<void> {
    // Dependencies first: a failed registration must not poison the namespace.
    assertUnitDependencies(this.units, kind, unit.name, unit.dependencies);
    claimUnitName(this.units, kind, unit.name);
    const label = kind === "plugin" ? "Plugin" : "Module";
    const subsystem = kind === "plugin" ? "plugins" : "modules";
    try {
      await unit.setup(this.hostFor(kind, unit.name));
    } catch (error) {
      const frameworkError = toFrameworkError(
        "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED",
        "Plugin",
        `${label} "${unit.name}" failed to initialize`,
        error,
        { subsystem, event: `${kind}.setup`, [kind]: unit.name },
        {
          likelyCause: `The ${kind} "${unit.name}" threw during setup().`,
          suggestedInvestigation: [
            `Review ${unit.name}.setup() for missing services or bad configuration.`,
            `Check whether a required service was registered before bot.${kind}() ran.`,
          ],
        },
      );
      this.logger.error(
        {
          subsystem,
          event: `${kind}.failed`,
          [kind]: unit.name,
          error: serializeError(frameworkError),
        },
        frameworkError.message,
      );
      throw frameworkError;
    }
    this.logger.info(
      { subsystem, event: `${kind}.loaded`, [kind]: unit.name },
      `${label} "${unit.name}" loaded`,
    );
  }

  getStatus(): BotStatus {
    return this.status;
  }

  getCommandNames(): string[] {
    return this.registry.names();
  }

  getCommandDefinitions(): CommandDefinition[] {
    return this.registry.definitions();
  }

  getContextMenuDefinitions(): ContextMenuDefinition[] {
    return this.contextMenus.values();
  }

  // -- lifecycle -----------------------------------------------------------

  async start(): Promise<void> {
    if (this.status === "ready" || this.status === "starting") {
      return;
    }
    if (this.status === "stopping") {
      throw new FrameworkError({
        code: "FRAMEWORK_LIFECYCLE_HOOK_FAILED",
        category: "Framework",
        message: "Cannot start while the bot is stopping",
        context: { subsystem: "lifecycle", event: "bot.start" },
      });
    }
    const startedAt = Date.now();
    this.status = "starting";
    this.logger.info(
      { subsystem: "lifecycle", event: "bot.starting" },
      "Bot starting",
    );
    try {
      await this.runHooks("beforeStart");
      await this.startConnector();
      this.status = "ready";
      await this.runHooks("afterStart");
    } catch (error) {
      this.status = "idle";
      throw error;
    }
    this.logger.info(
      {
        subsystem: "lifecycle",
        event: "bot.started",
        durationMs: Date.now() - startedAt,
      },
      "Bot started",
    );
  }

  async stop(): Promise<void> {
    if (
      this.status === "idle" ||
      this.status === "stopped" ||
      this.status === "stopping"
    ) {
      return;
    }
    this.status = "stopping";
    this.logger.info(
      { subsystem: "lifecycle", event: "bot.stopping" },
      "Bot stopping",
    );
    try {
      await this.withTimeout(
        (async () => {
          await this.runHooks("beforeStop");
          await this.connector?.stop();
          await this.runHooks("afterStop");
        })(),
        this.config.shutdownTimeoutMs,
        "bot.stop",
      );
    } finally {
      this.status = "stopped";
    }
    this.logger.info(
      { subsystem: "lifecycle", event: "bot.stopped" },
      "Bot stopped",
    );
  }

  private async startConnector(): Promise<void> {
    if (this.connector === undefined) {
      return;
    }
    try {
      await this.connector.start();
    } catch (error) {
      throw toFrameworkError(
        "FRAMEWORK_CONNECTOR_START_FAILED",
        "Dependency",
        `Connector "${this.connector.name}" failed to start`,
        error,
        { subsystem: "lifecycle", event: "connector.start" },
        {
          likelyCause:
            "Network, authentication (bad token), or gateway failure while connecting.",
          suggestedInvestigation: [
            "Verify DISCORD_TOKEN is valid and not revoked.",
            "Check network access to Discord's gateway.",
            "Look for DiscordAPI/Gateway errors earlier in the logs.",
          ],
        },
      );
    }
  }

  private async runHooks(event: BotLifecycleEvent): Promise<void> {
    for (const hook of this.hooks[event]) {
      try {
        await hook();
      } catch (error) {
        const frameworkError = isFrameworkError(error)
          ? error
          : toFrameworkError(
              "FRAMEWORK_LIFECYCLE_HOOK_FAILED",
              "Framework",
              `Lifecycle hook "${event}" failed`,
              error,
              { subsystem: "lifecycle", event },
            );
        this.logger.error(
          {
            subsystem: "lifecycle",
            event,
            error: serializeError(frameworkError),
          },
          frameworkError.message,
        );
        throw frameworkError;
      }
    }
  }

  private async withTimeout(
    promise: Promise<void>,
    ms: number,
    operation: string,
  ): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new FrameworkError({
                code: "FRAMEWORK_SHUTDOWN_TIMEOUT",
                category: "Internal",
                message: `Timed out waiting for ${operation} after ${ms}ms`,
                context: { subsystem: "lifecycle", event: "bot.stop" },
                diagnostic: {
                  likelyCause:
                    "A beforeStop/afterStop hook or the connector did not settle in time.",
                  suggestedInvestigation: [
                    "Identify slow hooks or in-flight work blocking shutdown.",
                    "Increase shutdownTimeoutMs if long drains are expected.",
                  ],
                },
              }),
            );
          }, ms);
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  // -- dispatch (hot path) ---------------------------------------------------

  /**
   * Route one interaction to its handler (slash command, component, modal,
   * autocomplete, or context menu). Never throws: failures are logged with
   * full context and returned as `{ ok: false, error }`.
   */
  async handleInteraction(
    rawInteraction: unknown,
    rawClient: unknown = undefined,
  ): Promise<DispatchResult> {
    const requestId = randomUUID();
    const startedAt = Date.now();

    if (isChatInputCommandInteraction(rawInteraction)) {
      return this.dispatchCommand(
        rawInteraction,
        rawClient,
        requestId,
        startedAt,
      );
    }
    if (interactionFlag(rawInteraction, "isAutocomplete")) {
      return this.dispatchAutocomplete(
        rawInteraction,
        rawClient,
        requestId,
        startedAt,
      );
    }
    if (interactionFlag(rawInteraction, "isModalSubmit")) {
      return this.dispatchModal(
        rawInteraction,
        rawClient,
        requestId,
        startedAt,
      );
    }
    const menuType = detectContextMenuType(rawInteraction);
    if (menuType !== undefined) {
      return this.dispatchContextMenu(
        rawInteraction,
        rawClient,
        menuType,
        requestId,
        startedAt,
      );
    }
    if (isComponentInteraction(rawInteraction)) {
      return this.dispatchComponent(
        rawInteraction,
        rawClient,
        requestId,
        startedAt,
      );
    }
    this.logger.debug(
      { subsystem: "dispatch", event: "interaction.ignored", requestId },
      "Ignoring unrecognized interaction",
    );
    return {
      ok: true,
      command: "",
      durationMs: Date.now() - startedAt,
      requestId,
    };
  }

  private async dispatchCommand(
    rawInteraction: unknown,
    rawClient: unknown,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const commandName = this.peekCommandName(rawInteraction);
    try {
      const definition =
        commandName !== undefined ? this.registry.get(commandName) : undefined;
      if (commandName === undefined || definition === undefined) {
        throw missingCommandError(
          commandName,
          this.peekId(rawInteraction),
          requestId,
        );
      }

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "command.execute",
        command: definition.name,
        requestId,
      });
      // Validate interaction options against the schema before the handler
      // runs, so malformed payloads fail with a classified validation error.
      const options = parseOptions(rawInteraction, definition.options, {
        command: definition.name,
        requestId,
      });
      const ctx = createCommandContext({
        interaction: rawInteraction,
        client: rawClient,
        logger,
        services: this.services,
        requestId,
        options,
      });
      // Enrich the scoped logger with Discord ids once the context is built.
      const scoped = logger.child({
        interactionId: ctx.interactionId,
        guildId: ctx.guildId,
        channelId: ctx.channelId,
        userId: ctx.userId,
      });

      const chain = [
        ...this.globalMiddleware,
        ...(definition.middleware ?? []),
      ];
      const dispatchCtx = { ...ctx, logger: scoped };
      const stage = this.guardStage(definition, definition.execute);
      await compose<CommandContext>(chain)(dispatchCtx, stage.run);
      const denied = stage.decision();
      if (denied === undefined) {
        const durationMs = Date.now() - startedAt;
        scoped.info({ durationMs }, `Command "${definition.name}" completed`);
        return { ok: true, command: definition.name, durationMs, requestId };
      }
      return this.denyDispatch({
        route: definition.name,
        event: "command.denied",
        reply: dispatchCtx.reply,
        decision: denied,
        requestId,
        startedAt,
      });
    } catch (error) {
      return this.failDispatch({
        route: commandName ?? "<unknown>",
        event: "command.failed",
        rawInteraction,
        requestId,
        startedAt,
        error,
        fallbackMessage:
          commandName !== undefined
            ? `Command "${commandName}" failed`
            : "Command dispatch failed",
      });
    }
  }

  private async dispatchComponent(
    rawInteraction: unknown,
    rawClient: unknown,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const customId = this.peekCustomId(rawInteraction);
    try {
      if (customId === undefined) {
        throw missingComponentError(
          "<unknown>",
          this.peekId(rawInteraction),
          requestId,
        );
      }
      const resolved = this.components.resolve(customId);
      if (resolved === undefined) {
        throw missingComponentError(
          customId,
          this.peekId(rawInteraction),
          requestId,
        );
      }
      const detected = detectComponentType(rawInteraction);
      if (
        resolved.definition.type !== undefined &&
        resolved.definition.type !== detected
      ) {
        throw new FrameworkError({
          code: "FRAMEWORK_ROUTE_NOT_FOUND",
          category: "Application",
          message: `Component "${customId}" is registered as ${resolved.definition.type} but received a ${detected} interaction`,
          context: {
            subsystem: "dispatch",
            event: "route.missing",
            command: customId,
            interactionId: this.peekId(rawInteraction),
            requestId,
          },
          diagnostic: {
            likelyCause:
              "Two definitions share a customId across component kinds, or the wrong customId was used.",
            suggestedInvestigation: [
              "Check that button and select customIds do not collide.",
              "If the handler serves several kinds intentionally, drop the type field from its definition.",
            ],
          },
        });
      }

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "component.execute",
        command: customId,
        requestId,
      });
      const ctx = createComponentContext({
        interaction: rawInteraction,
        customId,
        args: resolved.args,
        client: rawClient,
        logger,
        services: this.services,
        requestId,
      });
      const scoped = logger.child({ ...extractInteractionIds(rawInteraction) });

      const chain = [
        ...this.globalMiddleware,
        ...(resolved.definition.middleware ?? []),
      ];
      const dispatchCtx = { ...ctx, logger: scoped };
      const stage = this.guardStage(
        resolved.definition,
        resolved.definition.execute,
      );
      await compose<ComponentContext>(chain)(dispatchCtx, stage.run);
      const denied = stage.decision();
      if (denied === undefined) {
        const durationMs = Date.now() - startedAt;
        scoped.info({ durationMs }, `Component "${customId}" completed`);
        return { ok: true, command: customId, durationMs, requestId };
      }
      return this.denyDispatch({
        route: customId,
        event: "component.denied",
        reply: dispatchCtx.reply,
        decision: denied,
        requestId,
        startedAt,
      });
    } catch (error) {
      return this.failDispatch({
        route: customId ?? "<unknown>",
        event: "component.failed",
        rawInteraction,
        requestId,
        startedAt,
        error,
        fallbackMessage: `Component "${customId ?? "<unknown>"}" failed`,
      });
    }
  }

  private async dispatchModal(
    rawInteraction: unknown,
    rawClient: unknown,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const customId = this.peekCustomId(rawInteraction);
    try {
      if (customId === undefined) {
        throw missingModalError(
          "<unknown>",
          this.peekId(rawInteraction),
          requestId,
        );
      }
      const resolved = this.modals.resolve(customId);
      if (resolved === undefined) {
        throw missingModalError(
          customId,
          this.peekId(rawInteraction),
          requestId,
        );
      }

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "modal.execute",
        command: customId,
        requestId,
      });
      const ctx = createModalContext({
        interaction: rawInteraction,
        customId,
        args: resolved.args,
        client: rawClient,
        logger,
        services: this.services,
        requestId,
      });
      const scoped = logger.child({ ...extractInteractionIds(rawInteraction) });

      const chain = [
        ...this.globalMiddleware,
        ...(resolved.definition.middleware ?? []),
      ];
      const dispatchCtx = { ...ctx, logger: scoped };
      const stage = this.guardStage(
        resolved.definition,
        resolved.definition.execute,
      );
      await compose<ModalContext>(chain)(dispatchCtx, stage.run);
      const denied = stage.decision();
      if (denied === undefined) {
        const durationMs = Date.now() - startedAt;
        scoped.info({ durationMs }, `Modal "${customId}" completed`);
        return { ok: true, command: customId, durationMs, requestId };
      }
      return this.denyDispatch({
        route: customId,
        event: "modal.denied",
        reply: dispatchCtx.reply,
        decision: denied,
        requestId,
        startedAt,
      });
    } catch (error) {
      return this.failDispatch({
        route: customId ?? "<unknown>",
        event: "modal.failed",
        rawInteraction,
        requestId,
        startedAt,
        error,
        fallbackMessage: `Modal "${customId ?? "<unknown>"}" failed`,
      });
    }
  }

  private async dispatchAutocomplete(
    rawInteraction: unknown,
    rawClient: unknown,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const commandName = this.peekCommandName(rawInteraction) ?? "<unknown>";
    try {
      const focused = extractFocusedOption(rawInteraction, {
        command: commandName,
        requestId,
      });
      const definition = this.autocompletes.resolve(commandName, focused.name);
      if (definition === undefined) {
        throw missingAutocompleteError(
          commandName,
          focused.name,
          this.peekId(rawInteraction),
          requestId,
        );
      }
      const command = this.registry.get(commandName);

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "autocomplete.execute",
        command: commandName,
        requestId,
      });
      const ids = extractInteractionIds(rawInteraction);
      const scoped = logger.child({ ...ids });
      const ctx = createAutocompleteContext({
        interaction: rawInteraction,
        commandName,
        focused,
        schema: command?.options,
        client: rawClient,
        logger: scoped,
        services: this.services,
        requestId,
      });

      const chain = [
        ...this.globalMiddleware,
        ...(definition.middleware ?? []),
      ];
      const stage = this.guardStage(definition, definition.execute);
      await compose<AutocompleteContext>(chain)(ctx, stage.run);
      const denied = stage.decision();
      if (denied !== undefined) {
        return this.denyAutocomplete(
          ctx,
          scoped,
          commandName,
          denied,
          requestId,
          startedAt,
        );
      }

      if (!ctx.responded) {
        // Autocomplete must produce choices; an empty list is friendlier
        // than Discord timing out with no feedback.
        try {
          await ctx.respond([]);
          scoped.debug(
            { event: "autocomplete.emptyRespond" },
            "Handler sent no choices; responded []",
          );
        } catch (respondError) {
          scoped.debug(
            {
              event: "autocomplete.emptyRespondFailed",
              error: serializeError(respondError),
            },
            "Automatic empty autocomplete response failed",
          );
        }
      }

      const durationMs = Date.now() - startedAt;
      scoped.info(
        { durationMs },
        `Autocomplete for "${commandName}" completed`,
      );
      return { ok: true, command: commandName, durationMs, requestId };
    } catch (error) {
      return this.failDispatch({
        route: commandName,
        event: "autocomplete.failed",
        rawInteraction,
        requestId,
        startedAt,
        error,
        fallbackMessage: `Autocomplete for "${commandName}" failed`,
      });
    }
  }

  private async dispatchContextMenu(
    rawInteraction: unknown,
    rawClient: unknown,
    menuType: ContextMenuType,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const name = this.peekCommandName(rawInteraction);
    try {
      if (name === undefined) {
        throw missingContextMenuError(
          menuType,
          "<unknown>",
          this.peekId(rawInteraction),
          requestId,
        );
      }
      const definition = this.contextMenus.resolve(menuType, name);
      if (definition === undefined) {
        throw missingContextMenuError(
          menuType,
          name,
          this.peekId(rawInteraction),
          requestId,
        );
      }

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "contextmenu.execute",
        command: name,
        requestId,
      });
      const ctx = createContextMenuContext({
        interaction: rawInteraction,
        definition,
        client: rawClient,
        logger,
        services: this.services,
        requestId,
      });
      const scoped = logger.child({ ...extractInteractionIds(rawInteraction) });

      const chain = [
        ...this.globalMiddleware,
        ...(definition.middleware ?? []),
      ];
      const dispatchCtx = { ...ctx, logger: scoped };
      const stage = this.guardStage(definition, definition.execute);
      await compose<ContextMenuContext>(chain)(dispatchCtx, stage.run);
      const denied = stage.decision();
      if (denied === undefined) {
        const durationMs = Date.now() - startedAt;
        scoped.info({ durationMs }, `Context-menu "${name}" completed`);
        return { ok: true, command: name, durationMs, requestId };
      }
      return this.denyDispatch({
        route: name,
        event: "contextmenu.denied",
        reply: dispatchCtx.reply,
        decision: denied,
        requestId,
        startedAt,
      });
    } catch (error) {
      return this.failDispatch({
        route: name ?? "<unknown>",
        event: "contextmenu.failed",
        rawInteraction,
        requestId,
        startedAt,
        error,
        fallbackMessage: `Context-menu "${name ?? "<unknown>"}" failed`,
      });
    }
  }

  /**
   * Guard stage wrapping a pipeline handler: middleware runs first, then
   * global + definition guards, then the handler. A deny short-circuits the
   * handler; the pipeline replies gracefully via `denyDispatch`.
   */
  private guardStage<C extends BaseInteractionContext>(
    definition: object,
    execute: (ctx: C) => void | Promise<void>,
  ): { run(ctx: C): Promise<void>; decision(): GuardDecision | undefined } {
    let denied: GuardDecision | undefined;
    return {
      run: async (ctx: C): Promise<void> => {
        const decision = await runGuards(
          [...this.globalGuards, ...this.guardsFor(definition)],
          ctx,
        );
        if (!decision.allowed) {
          denied = decision;
          return;
        }
        await execute(ctx);
      },
      decision: () => denied,
    };
  }

  /** Graceful deny: user message, observability log, ok result. Never throws. */
  private async denyDispatch(init: {
    route: string;
    event: string;
    reply: (message: string) => Promise<void>;
    decision: GuardDecision;
    requestId: string;
    startedAt: number;
  }): Promise<DispatchResult> {
    const durationMs = Date.now() - init.startedAt;
    try {
      await init.reply(init.decision.message ?? DEFAULT_DENY_MESSAGE);
    } catch (replyError) {
      this.logger.debug(
        {
          subsystem: "dispatch",
          event: "deny.replyFailed",
          command: init.route,
          requestId: init.requestId,
          error: serializeError(replyError),
        },
        "Deny reply failed (likely already acknowledged)",
      );
    }
    this.logger.info(
      {
        subsystem: "dispatch",
        event: init.event,
        command: init.route,
        guard: init.decision.guard,
        requestId: init.requestId,
        durationMs,
      },
      `Denied by guard "${init.decision.guard}"`,
    );
    return {
      ok: true,
      command: init.route,
      durationMs,
      requestId: init.requestId,
    };
  }

  /** Autocomplete denies have no message surface: answer with no choices. */
  private async denyAutocomplete(
    ctx: AutocompleteContext,
    scoped: FrameworkLogger,
    route: string,
    decision: GuardDecision,
    requestId: string,
    startedAt: number,
  ): Promise<DispatchResult> {
    const durationMs = Date.now() - startedAt;
    if (!ctx.responded) {
      try {
        await ctx.respond([]);
      } catch (respondError) {
        scoped.debug(
          {
            event: "deny.respondFailed",
            error: serializeError(respondError),
          },
          "Deny autocomplete response failed",
        );
      }
    }
    scoped.info(
      { event: "autocomplete.denied", guard: decision.guard, durationMs },
      `Denied by guard "${decision.guard}"`,
    );
    return { ok: true, command: route, durationMs, requestId };
  }

  /** Shared failure path: classify, log with context, recover, return. */
  private async failDispatch(init: {
    route: string;
    event: string;
    rawInteraction: unknown;
    requestId: string;
    startedAt: number;
    error: unknown;
    fallbackMessage: string;
  }): Promise<DispatchFailure> {
    const durationMs = Date.now() - init.startedAt;
    const frameworkError = isFrameworkError(init.error)
      ? init.error
      : toFrameworkError(
          "FRAMEWORK_COMMAND_HANDLER_FAILED",
          this.looksLikeDiscordApiError(init.error)
            ? "DiscordAPI"
            : "Application",
          init.fallbackMessage,
          init.error,
          {
            subsystem: "dispatch",
            event: init.event,
            command: init.route,
            interactionId: this.peekId(init.rawInteraction),
            requestId: init.requestId,
          },
          {
            likelyCause:
              "The handler (or its middleware) threw an unexpected error.",
            suggestedInvestigation: [
              "Read the error name/message/stack attached to this log line.",
              "Reproduce with the sandbox-bot failure-injection commands.",
              "If the error came from Discord's API, check status/code and retryability.",
            ],
          },
        );
    this.logger.error(
      {
        subsystem: "dispatch",
        event: init.event,
        command: init.route,
        interactionId: this.peekId(init.rawInteraction),
        requestId: init.requestId,
        durationMs,
        error: serializeError(frameworkError),
      },
      frameworkError.message,
    );
    await this.tryRecover(init.rawInteraction, init.requestId);
    return {
      ok: false,
      error: frameworkError,
      durationMs,
      requestId: init.requestId,
    };
  }

  private peekCommandName(raw: unknown): string | undefined {
    if (typeof raw === "object" && raw !== null) {
      const name = (raw as { commandName?: unknown }).commandName;
      return typeof name === "string" && name.length > 0 ? name : undefined;
    }
    return undefined;
  }

  private peekCustomId(raw: unknown): string | undefined {
    if (typeof raw === "object" && raw !== null) {
      const id = (raw as { customId?: unknown }).customId;
      return typeof id === "string" && id.length > 0 ? id : undefined;
    }
    return undefined;
  }

  private peekId(raw: unknown): string | undefined {
    if (typeof raw === "object" && raw !== null) {
      const id = (raw as { id?: unknown }).id;
      return typeof id === "string" ? id : undefined;
    }
    return undefined;
  }

  private looksLikeDiscordApiError(error: unknown): boolean {
    if (typeof error === "object" && error !== null) {
      const record = error as Record<string, unknown>;
      return (
        typeof record.status === "number" ||
        typeof record.statusCode === "number"
      );
    }
    return false;
  }

  /** Best-effort user-facing recovery. Never throws. */
  private async tryRecover(
    rawInteraction: unknown,
    requestId: string,
  ): Promise<void> {
    if (typeof rawInteraction !== "object" || rawInteraction === null) {
      return;
    }
    const reply = (rawInteraction as { reply?: unknown }).reply;
    if (typeof reply !== "function") {
      return;
    }
    try {
      await (reply as (message: string) => Promise<unknown>).call(
        rawInteraction,
        "Something went wrong while running that command.",
      );
    } catch (recoveryError) {
      this.logger.debug(
        {
          subsystem: "dispatch",
          event: "recovery.failed",
          requestId,
          error: serializeError(recoveryError),
        },
        "User-facing error recovery failed (likely already acknowledged)",
      );
    }
  }
}

function describeAutocompleteTarget(
  definition: AutocompleteDefinition,
): string {
  return definition.option === undefined
    ? definition.command
    : `${definition.command}:${definition.option}`;
}

function detectContextMenuType(raw: unknown): ContextMenuType | undefined {
  if (interactionFlag(raw, "isUserContextMenuCommand")) {
    return "user";
  }
  if (interactionFlag(raw, "isMessageContextMenuCommand")) {
    return "message";
  }
  return undefined;
}

function routeDiagnostic(
  registerCall: string,
  extra: string[],
): {
  likelyCause: string;
  suggestedInvestigation: string[];
} {
  return {
    likelyCause: `The interaction arrived but nothing is registered for it (missing ${registerCall} call or deploy drift).`,
    suggestedInvestigation: [
      `Check that ${registerCall} was called before bot.start().`,
      "Re-run command deployment so Discord knows about it.",
      ...extra,
    ],
  };
}

function missingCommandError(
  commandName: string | undefined,
  interactionId: string | undefined,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_ROUTE_NOT_FOUND",
    category: "Application",
    message:
      commandName === undefined
        ? "Interaction did not carry a usable commandName"
        : `No command registered for "${commandName}"`,
    context: {
      subsystem: "dispatch",
      event: "route.missing",
      command: commandName,
      interactionId,
      requestId,
    },
    diagnostic: routeDiagnostic("bot.command()", [
      "If using guild commands, allow for propagation delay or check the guild id.",
    ]),
  });
}

function missingComponentError(
  customId: string,
  interactionId: string | undefined,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_ROUTE_NOT_FOUND",
    category: "Application",
    message: `No component registered for customId "${customId}"`,
    context: {
      subsystem: "dispatch",
      event: "route.missing",
      command: customId,
      interactionId,
      requestId,
    },
    diagnostic: routeDiagnostic("bot.component()", [
      'Prefix matching splits on ":" — registering "vote" also serves "vote:yes".',
    ]),
  });
}

function missingModalError(
  customId: string,
  interactionId: string | undefined,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_ROUTE_NOT_FOUND",
    category: "Application",
    message: `No modal registered for customId "${customId}"`,
    context: {
      subsystem: "dispatch",
      event: "route.missing",
      command: customId,
      interactionId,
      requestId,
    },
    diagnostic: routeDiagnostic("bot.modal()", []),
  });
}

function missingAutocompleteError(
  command: string,
  option: string,
  interactionId: string | undefined,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_ROUTE_NOT_FOUND",
    category: "Application",
    message: `No autocomplete handler registered for "${command}:${option}"`,
    context: {
      subsystem: "dispatch",
      event: "route.missing",
      command,
      interactionId,
      requestId,
    },
    diagnostic: routeDiagnostic("bot.autocomplete()", [
      "Register a handler for the specific option, or a command-level fallback without option.",
    ]),
  });
}

function missingContextMenuError(
  menuType: ContextMenuType,
  name: string,
  interactionId: string | undefined,
  requestId: string,
): FrameworkError {
  return new FrameworkError({
    code: "FRAMEWORK_ROUTE_NOT_FOUND",
    category: "Application",
    message: `No ${menuType} context-menu registered for "${name}"`,
    context: {
      subsystem: "dispatch",
      event: "route.missing",
      command: name,
      interactionId,
      requestId,
    },
    diagnostic: routeDiagnostic("bot.contextMenu()", [
      "Context-menu names must match exactly (including capitals and spaces).",
    ]),
  });
}
