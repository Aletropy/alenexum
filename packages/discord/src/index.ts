/**
 * `@alenexum/discord` — thin transport adapter over discord.js.
 *
 * discord.js owns Gateway, REST, rate limits, caches, and builders. This
 * package only adapts them to core's {@link Connector} contract and deploys
 * registered commands via Discord's REST API. No Discord subsystem is
 * reimplemented here.
 */

export {
  collectDeployBody,
  toContextMenuJSON,
  toSlashCommandJSON,
} from "./deploy.js";
export {
  createDiscordConnector,
  type DeployOptions,
  type DiscordConnector,
  type DiscordConnectorOptions,
} from "./discord-connector.js";
