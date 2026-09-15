#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ScaffoldOptions } from "./options.js";
import {
  type DeployMode,
  type Flags,
  type IntentsPreset,
  type LogLevel,
  type PackageManager,
  parseArgs,
  sanitizeProjectName,
} from "./options.js";
import {
  installArgs,
  isNonEmptyDir,
  planScaffold,
  writeScaffold,
} from "./scaffold.js";

const HELP = `create-alenexum-bot — scaffold a new Alenexum Discord bot.

Usage:
  npm create alenexum-bot@latest [name] [flags]
  pnpm create alenexum-bot [name] [flags]

Arguments:
  name                    Project directory and package name.

Flags:
  -y, --yes               Accept defaults, skip all prompts.
  --pm=<npm|pnpm|yarn|bun> Package manager for the install step.
  --token <token>         Discord bot token (written to .env only, never logged).
  --no-token              Skip the token prompt entirely.
  --no-install            Scaffold only; do not run the install step.
  --no-git                Skip git initialization.
  -f, --force             Overwrite a non-empty target directory.
  -h, --help              Show this help.

The token is optional: without it the CLI emits .env.example and warns you
at the end. Secrets are never printed, logged, or committed by the CLI.
`;

function fail(message: string): never {
  p.log.error(message);
  process.exit(1);
}

function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? "";
  if (agent.startsWith("pnpm")) return "pnpm";
  if (agent.startsWith("yarn")) return "yarn";
  if (agent.startsWith("bun")) return "bun";
  return "npm";
}

function defaultOptions(): ScaffoldOptions {
  return {
    projectName: "my-bot",
    targetDir: resolve(process.cwd(), "my-bot"),
    packageManager: detectPackageManager(),
    intents: "minimal",
    deployMode: "skip",
    guildId: undefined,
    logLevel: "info",
    features: { telemetry: false, jobs: false, testing: false },
    token: undefined,
    install: true,
    git: true,
    force: false,
  };
}

function cancelled(): never {
  p.log.warn("Scaffolding cancelled.");
  process.exit(1);
}

async function main(): Promise<void> {
  const { name: nameArg, flags }: { name: string | undefined; flags: Flags } =
    parseArgs(process.argv.slice(2));

  if (flags.help) {
    process.stdout.write(HELP);
    return;
  }
  if (flags.token !== undefined && flags.noToken === true) {
    fail("Cannot combine --token with --no-token.");
  }

  p.intro("create-alenexum-bot");
  const options = defaultOptions();
  if (flags.packageManager !== undefined)
    options.packageManager = flags.packageManager;
  if (flags.install === false) options.install = false;
  if (flags.git === false) options.git = false;
  if (flags.force === true) options.force = true;

  if (flags.yes === true) {
    if (nameArg !== undefined) {
      options.projectName = sanitizeProjectName(nameArg);
      options.targetDir = resolve(process.cwd(), options.projectName);
    }
    if (flags.token !== undefined) {
      if (flags.token.length === 0)
        fail("Empty token: omit --token to skip it.");
      options.token = flags.token;
    }
  } else {
    const nameAnswer = await p.text({
      message: "Bot / project name?",
      placeholder: "my-bot",
      initialValue: nameArg ?? "",
      validate: (value) => {
        if (value.trim().length === 0) return "Name is required.";
        try {
          sanitizeProjectName(value);
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid name.";
        }
        return undefined;
      },
    });
    if (p.isCancel(nameAnswer)) return cancelled();
    options.projectName = sanitizeProjectName(nameAnswer);
    options.targetDir = resolve(process.cwd(), options.projectName);

    const pm = await p.select({
      message: "Package manager?",
      options: (["npm", "pnpm", "yarn", "bun"] as const).map((value) => ({
        value,
        label: value,
      })),
      initialValue: options.packageManager,
    });
    if (p.isCancel(pm)) return cancelled();
    options.packageManager = flags.packageManager ?? (pm as PackageManager);

    const intents = await p.select({
      message: "Gateway intents?",
      options: [
        { value: "minimal", label: "Minimal", hint: "Guilds only" },
        {
          value: "standard",
          label: "Standard",
          hint: "Guilds + messages + message content (needs portal toggle)",
        },
      ],
      initialValue: "minimal",
    });
    if (p.isCancel(intents)) return cancelled();
    options.intents = intents as IntentsPreset;

    const deploy = await p.select({
      message: "Command deployment?",
      options: [
        { value: "guild", label: "Guild", hint: "instant, needs GUILD_ID" },
        { value: "global", label: "Global", hint: "slow propagation" },
        { value: "skip", label: "Skip", hint: "deploy later" },
      ],
      initialValue: "skip",
    });
    if (p.isCancel(deploy)) return cancelled();
    options.deployMode = deploy as DeployMode;

    if (deploy === "guild") {
      const guildId = await p.text({
        message: "Development guild ID? (empty skips guild deploy)",
        placeholder: "123456789012345678",
        validate: (value) => {
          const trimmed = value.trim();
          if (trimmed.length === 0) return undefined;
          return /^\d{10,25}$/.test(trimmed)
            ? undefined
            : "Guild IDs are 10-25 digit snowflakes.";
        },
      });
      if (p.isCancel(guildId)) return cancelled();
      options.guildId = guildId.trim().length > 0 ? guildId.trim() : undefined;
    }

    const logLevel = await p.select({
      message: "Log level?",
      options: (["debug", "info", "warn", "error"] as const).map((value) => ({
        value,
        label: value,
      })),
      initialValue: "info",
    });
    if (p.isCancel(logLevel)) return cancelled();
    options.logLevel = logLevel as LogLevel;

    const features = await p.multiselect({
      message: "Optional features?",
      options: [
        { value: "telemetry", label: "Telemetry", hint: "metrics + health" },
        {
          value: "jobs",
          label: "Jobs",
          hint: "background scheduler + heartbeat",
        },
        { value: "testing", label: "Testing", hint: "vitest + sample test" },
      ],
      required: false,
    });
    if (p.isCancel(features)) return cancelled();
    const featureList = features as string[];
    options.features = {
      telemetry: featureList.includes("telemetry"),
      jobs: featureList.includes("jobs"),
      testing: featureList.includes("testing"),
    };

    if (flags.token !== undefined) {
      if (flags.token.length === 0)
        fail("Empty token: omit --token to skip it.");
      options.token = flags.token;
    } else if (flags.noToken !== true) {
      const token = await p.password({
        message: "Discord bot token? (empty skips — written to .env only)",
        mask: "•",
      });
      if (p.isCancel(token)) return cancelled();
      options.token = token.length > 0 ? token : undefined;
    }

    if (options.install) {
      const install = await p.confirm({
        message: `Run install (${options.packageManager}) after scaffolding?`,
        initialValue: true,
      });
      if (p.isCancel(install)) return cancelled();
      options.install = install;
    }

    if (options.git) {
      const git = await p.confirm({
        message: "Initialize a git repository?",
        initialValue: true,
      });
      if (p.isCancel(git)) return cancelled();
      options.git = git;
    }
  }

  if (isNonEmptyDir(options.targetDir) && !options.force) {
    fail(
      `Target directory ${options.targetDir} is not empty. Re-run with --force to overwrite.`,
    );
  }

  const spinner = p.spinner();
  spinner.start("Scaffolding project");
  const files = planScaffold(options);
  writeScaffold(options.targetDir, files, options);
  spinner.stop(`Scaffolded ${files.length} files into ${options.projectName}`);

  if (options.install) {
    const installSpinner = p.spinner();
    installSpinner.start(`Installing with ${options.packageManager}`);
    const [command, ...args] = installArgs(options.packageManager) as [
      string,
      ...string[],
    ];
    const result = spawnSync(command, args, {
      cwd: options.targetDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      installSpinner.stop("Install failed", 1);
      fail(
        `Install step failed. Run it manually inside ${options.projectName}.`,
      );
    }
    installSpinner.stop("Dependencies installed");
  }

  if (options.git) {
    const gitCheck = spawnSync("git", ["--version"], { stdio: "ignore" });
    if (gitCheck.status === 0) {
      spawnSync("git", ["init"], { cwd: options.targetDir, stdio: "ignore" });
      spawnSync("git", ["add", "-A"], {
        cwd: options.targetDir,
        stdio: "ignore",
      });
    }
  }

  const lines = [
    `cd ${options.projectName}`,
    ...(options.token === undefined
      ? ["# set DISCORD_TOKEN in .env (see .env.example)"]
      : []),
    ...(!options.install ? [`${options.packageManager} install`] : []),
    `${options.packageManager === "npm" ? "npm run" : options.packageManager} dev`,
  ];
  p.note(lines.join("\n"), "Next steps");
  if (options.token === undefined) {
    p.log.warn(
      "No token provided — the bot cannot log in until .env is filled in.",
    );
  }
  p.outro("Happy building!");
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
