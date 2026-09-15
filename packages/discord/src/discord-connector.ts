import { type Bot, type Connector, FrameworkError } from "@alenexum/core";
import { Client, type ClientOptions, Events, REST, Routes } from "discord.js";
import { collectDeployBody } from "./deploy.js";

export interface DeployOptions {
  /** `guild` deploys instantly (dev); `global` propagates slowly; `skip` deploys nothing. */
  mode: "guild" | "global" | "skip";
  guildId?: string | undefined;
}

export interface DiscordConnectorOptions {
  intents: ClientOptions["intents"];
  /** Extra discord.js client options (partials, etc.). Intents come from `intents`. */
  clientOptions?: Omit<Partial<ClientOptions>, "intents">;
  deploy?: DeployOptions;
}

export interface DiscordConnector extends Connector {
  readonly client: Client;
  /** Push registered commands to Discord via REST. Honors `deploy.mode`. */
  deployCommands(): Promise<void>;
}

/**
 * Adapt a discord.js `Client` to core's Connector contract:
 * login on start, `interactionCreate` → `bot.handleInteraction`, destroy on
 * stop. Dispatch results are already logged by core; the listener only guards
 * against unexpected listener-level failures.
 */
export function createDiscordConnector(
  bot: Bot,
  options: DiscordConnectorOptions,
): DiscordConnector {
  const client = new Client({
    ...options.clientOptions,
    intents: options.intents,
  });
  const deploy = options.deploy ?? { mode: "skip" };
  let listenerAttached = false;

  const connector: DiscordConnector = {
    name: "discord.js",
    client,

    async start(): Promise<void> {
      if (!listenerAttached) {
        client.on(Events.InteractionCreate, (interaction) => {
          bot.handleInteraction(interaction, client).catch((error: unknown) => {
            // Unreachable in practice (handleInteraction never rejects), kept
            // as a backstop so the event emitter never throws.
            bot.logger.error(
              {
                subsystem: "discord",
                event: "interaction.listener",
                error: { name: "ListenerError", message: String(error) },
              },
              "Interaction listener failed unexpectedly",
            );
          });
        });
        listenerAttached = true;
      }
      await client.login(bot.config.token);
      bot.logger.info(
        {
          subsystem: "discord",
          event: "client.ready",
          userId: client.user?.id,
        },
        `Logged in as ${client.user?.tag ?? "unknown"}`,
      );
    },

    async stop(): Promise<void> {
      await client.destroy();
    },

    async deployCommands(): Promise<void> {
      if (deploy.mode === "skip") {
        bot.logger.info(
          { subsystem: "discord", event: "commands.deploySkipped" },
          "Command deployment skipped",
        );
        return;
      }
      const applicationId = client.application?.id ?? client.user?.id;
      if (applicationId === undefined) {
        throw new FrameworkError({
          code: "FRAMEWORK_INVALID_CONFIGURATION",
          category: "Config",
          message:
            "Cannot deploy commands before login: application id is unknown",
          context: { subsystem: "discord", event: "commands.deploy" },
        });
      }
      if (
        deploy.mode === "guild" &&
        (deploy.guildId === undefined || deploy.guildId.length === 0)
      ) {
        throw new FrameworkError({
          code: "FRAMEWORK_INVALID_CONFIGURATION",
          category: "Config",
          message: "Guild command deployment requires a guildId",
          context: { subsystem: "discord", event: "commands.deploy" },
          diagnostic: {
            likelyCause: "deploy.mode is 'guild' but no guildId was provided.",
            suggestedInvestigation: [
              "Set GUILD_ID in the environment for guild-scoped dev deployment.",
            ],
          },
        });
      }
      const body = collectDeployBody(bot);
      const rest = new REST().setToken(bot.config.token);
      const route =
        deploy.mode === "guild"
          ? Routes.applicationGuildCommands(
              applicationId,
              deploy.guildId as string,
            )
          : Routes.applicationCommands(applicationId);
      await rest.put(route, { body });
      bot.logger.info(
        {
          subsystem: "discord",
          event: "commands.deployed",
          command: `${body.length} commands`,
          guildId: deploy.guildId ?? null,
        },
        `Deployed ${body.length} command(s) (${deploy.mode})`,
      );
    },
  };

  return connector;
}
