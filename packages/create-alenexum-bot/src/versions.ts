/**
 * Pinned dependency versions baked into every scaffolded project's
 * `package.json`. Bump these deliberately when the framework packages or
 * their peers cut a new release — they are not resolved dynamically, so a
 * scaffolded project never surprises a user with an unplanned upgrade.
 */
export interface TemplateVersions {
  readonly alenexumCore: string;
  readonly alenexumDiscord: string;
  readonly alenexumTelemetry: string;
  readonly alenexumJobs: string;
  readonly alenexumTesting: string;
  readonly discordJs: string;
  readonly dotenv: string;
  readonly tsx: string;
  readonly tsup: string;
  readonly typescript: string;
  readonly vitest: string;
  readonly biome: string;
  readonly nodeTypes: string;
}

export const TEMPLATE_VERSIONS: TemplateVersions = {
  alenexumCore: "^0.1.0",
  alenexumDiscord: "^0.1.0",
  alenexumTelemetry: "^0.1.0",
  alenexumJobs: "^0.1.0",
  alenexumTesting: "^0.1.0",
  discordJs: "^14.18.0",
  dotenv: "^16.4.5",
  tsx: "^4.19.0",
  tsup: "^8.5.0",
  typescript: "~5.9.3",
  vitest: "^3.2.4",
  biome: "^2.2.4",
  nodeTypes: "^22.10.0",
};
