/**
 * Transport connector (implemented by `@alenexum/discord`).
 *
 * Core owns the lifecycle and dispatch; the connector owns the network
 * (discord.js login, event wiring, teardown). This keeps core free of any
 * discord.js dependency — the dependency arrow is core <- discord.
 */
export interface Connector {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
