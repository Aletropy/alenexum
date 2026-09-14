import { randomUUID } from "node:crypto";
import type { CommandDefinition } from "./command.js";
import {
  type BotOptions,
  type ResolvedBotConfig,
  resolveConfig,
} from "./config.js";
import type { Connector } from "./connector.js";
import {
  createCommandContext,
  isChatInputCommandInteraction,
} from "./context.js";
import {
  FrameworkError,
  isFrameworkError,
  serializeError,
  toFrameworkError,
} from "./errors.js";
import { createLogger, type FrameworkLogger } from "./logger.js";
import { compose, type Middleware } from "./middleware.js";
import type { Plugin, PluginHost } from "./plugin.js";
import { CommandRegistry } from "./registry.js";
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
 * Application root. Owns lifecycle, the command registry, middleware, and
 * dispatch. Network transport is injected via a {@link Connector} so core
 * never depends on discord.js.
 */
export class Bot implements PluginHost {
  readonly config: ResolvedBotConfig;
  readonly logger: FrameworkLogger;
  readonly services = new ServiceContainer();

  private readonly registry = new CommandRegistry();
  private readonly globalMiddleware: Middleware[] = [];
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
    try {
      await plugin.setup(this);
    } catch (error) {
      const frameworkError = toFrameworkError(
        "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED",
        "Plugin",
        `Plugin "${plugin.name}" failed to initialize`,
        error,
        { subsystem: "plugins", event: "plugin.setup", plugin: plugin.name },
        {
          likelyCause: `The plugin "${plugin.name}" threw during setup().`,
          suggestedInvestigation: [
            `Review ${plugin.name}.setup() for missing services or bad configuration.`,
            "Check whether a required service was registered before bot.plugin() ran.",
          ],
        },
      );
      this.logger.error(
        {
          subsystem: "plugins",
          event: "plugin.failed",
          plugin: plugin.name,
          error: serializeError(frameworkError),
        },
        frameworkError.message,
      );
      throw frameworkError;
    }
    this.logger.info(
      { subsystem: "plugins", event: "plugin.loaded", plugin: plugin.name },
      `Plugin "${plugin.name}" loaded`,
    );
    return this;
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
   * Route one interaction to its command. Never throws: failures are logged
   * with full context and returned as `{ ok: false, error }`.
   */
  async handleInteraction(
    rawInteraction: unknown,
    rawClient: unknown = undefined,
  ): Promise<DispatchResult> {
    const requestId = randomUUID();
    const startedAt = Date.now();

    if (!isChatInputCommandInteraction(rawInteraction)) {
      this.logger.debug(
        { subsystem: "dispatch", event: "interaction.ignored", requestId },
        "Ignoring non-chat-input interaction",
      );
      return {
        ok: true,
        command: "",
        durationMs: Date.now() - startedAt,
        requestId,
      };
    }

    const commandName = this.peekCommandName(rawInteraction);
    try {
      const definition =
        commandName !== undefined ? this.registry.get(commandName) : undefined;
      if (commandName === undefined || definition === undefined) {
        throw new FrameworkError({
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
            interactionId: this.peekId(rawInteraction),
            requestId,
          },
          diagnostic: {
            likelyCause:
              "The command was invoked in Discord but is not registered on this bot instance (missing bot.command() call or deploy drift).",
            suggestedInvestigation: [
              "Check that bot.command() was called for this command before bot.start().",
              "Re-run command deployment so Discord knows about the command.",
              "If using guild commands, allow for propagation delay or check the guild id.",
            ],
          },
        });
      }

      const logger = this.logger.child({
        subsystem: "dispatch",
        event: "command.execute",
        command: definition.name,
        requestId,
      });
      const ctx = createCommandContext({
        interaction: rawInteraction,
        client: rawClient,
        logger,
        services: this.services,
        requestId,
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
      await compose(chain)({ ...ctx, logger: scoped }, definition.execute);

      const durationMs = Date.now() - startedAt;
      scoped.info({ durationMs }, `Command "${definition.name}" completed`);
      return { ok: true, command: definition.name, durationMs, requestId };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const frameworkError = isFrameworkError(error)
        ? error
        : toFrameworkError(
            "FRAMEWORK_COMMAND_HANDLER_FAILED",
            this.looksLikeDiscordApiError(error) ? "DiscordAPI" : "Application",
            commandName !== undefined
              ? `Command "${commandName}" failed`
              : "Command dispatch failed",
            error,
            {
              subsystem: "dispatch",
              event: "command.failed",
              command: commandName,
              interactionId: this.peekId(rawInteraction),
              requestId,
            },
            {
              likelyCause:
                "The command handler (or its middleware) threw an unexpected error.",
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
          event: "command.failed",
          command: commandName,
          interactionId: this.peekId(rawInteraction),
          requestId,
          durationMs,
          error: serializeError(frameworkError),
        },
        frameworkError.message,
      );
      await this.tryRecover(rawInteraction, frameworkError, requestId);
      return { ok: false, error: frameworkError, durationMs, requestId };
    }
  }

  private peekCommandName(raw: unknown): string | undefined {
    if (typeof raw === "object" && raw !== null) {
      const name = (raw as { commandName?: unknown }).commandName;
      return typeof name === "string" && name.length > 0 ? name : undefined;
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
    error: FrameworkError,
    requestId: string,
  ): Promise<void> {
    if (typeof rawInteraction !== "object" || rawInteraction === null) {
      return;
    }
    void error;
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
