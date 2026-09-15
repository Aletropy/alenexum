/**
 * CLI argument parsing and the option shapes threaded through the wizard,
 * the scaffolder, and the template renderer.
 */

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type IntentsPreset = "minimal" | "standard";
export type DeployMode = "guild" | "global" | "skip";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Features {
  readonly telemetry: boolean;
  readonly jobs: boolean;
  readonly testing: boolean;
}

export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  packageManager: PackageManager;
  intents: IntentsPreset;
  deployMode: DeployMode;
  guildId: string | undefined;
  logLevel: LogLevel;
  features: Features;
  token: string | undefined;
  install: boolean;
  git: boolean;
  force: boolean;
}

export interface Flags {
  help?: boolean;
  yes?: boolean;
  force?: boolean;
  install?: boolean;
  git?: boolean;
  noToken?: boolean;
  packageManager?: PackageManager;
  token?: string;
}

export interface ParsedArgs {
  name: string | undefined;
  flags: Flags;
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

export function sanitizeProjectName(raw: string): string {
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 214);
  if (name.length === 0 || !NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid project name ${JSON.stringify(raw)}: use lowercase letters, numbers, "-" or "_".`,
    );
  }
  return name;
}

export const PACKAGE_MANAGERS: readonly PackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
];

export function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let name: string | undefined;
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) break;
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--yes" || arg === "-y") {
      flags.yes = true;
    } else if (arg === "--force" || arg === "-f") {
      flags.force = true;
    } else if (arg === "--no-install") {
      flags.install = false;
    } else if (arg === "--no-git") {
      flags.git = false;
    } else if (arg === "--no-token") {
      flags.noToken = true;
    } else if (arg.startsWith("--pm=")) {
      const pm = arg.slice("--pm=".length);
      if (!isPackageManager(pm)) {
        throw new Error(
          `Invalid --pm ${JSON.stringify(pm)}: expected one of npm, pnpm, yarn, bun.`,
        );
      }
      flags.packageManager = pm;
    } else if (arg === "--token") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("Missing value: --token <discord-bot-token>.");
      }
      flags.token = value;
      i++;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown flag ${JSON.stringify(arg)}. See --help.`);
    } else if (name === undefined) {
      name = arg;
    } else {
      throw new Error(
        `Unexpected positional argument ${JSON.stringify(arg)}: only the project name is accepted.`,
      );
    }
  }
  return { name, flags };
}

export function intentsSnippet(preset: IntentsPreset): string {
  // Pre-wrapped to match how Biome would format the generated file's
  // `intents: [...]` array literal — the standard preset's three-intent
  // array doesn't fit on one line under the default line width.
  return preset === "standard"
    ? [
        "[",
        "    GatewayIntentBits.Guilds,",
        "    GatewayIntentBits.GuildMessages,",
        "    GatewayIntentBits.MessageContent,",
        "  ]",
      ].join("\n")
    : "[GatewayIntentBits.Guilds]";
}
