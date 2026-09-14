import { z } from "zod";
import type { Connector } from "./connector.js";
import { FrameworkError } from "./errors.js";
import type { FrameworkLogger } from "./logger.js";

const ConnectorSchema = z.custom<Connector>(
  (value): value is Connector =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as Connector).start === "function" &&
    typeof (value as Connector).stop === "function",
);

const LoggerSchema = z.custom<FrameworkLogger>(
  (value): value is FrameworkLogger =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as FrameworkLogger).info === "function" &&
    typeof (value as FrameworkLogger).child === "function",
);

export const BotOptionsSchema = z.object({
  /** Bot token. Validated, held for the connector, never logged. */
  token: z.string().min(1, "token must be a non-empty string"),
  /** Transport (discord.js wiring). Attach later via bot.attachConnector() if omitted. */
  connector: ConnectorSchema.optional(),
  /** Bring-your-own logger; a default pino logger is created otherwise. */
  logger: LoggerSchema.optional(),
  /** Upper bound for graceful shutdown before FRAMEWORK_SHUTDOWN_TIMEOUT. */
  shutdownTimeoutMs: z.number().int().positive().default(10_000),
});

export type BotOptions = z.input<typeof BotOptionsSchema>;
export type ResolvedBotConfig = z.output<typeof BotOptionsSchema>;

/** Validate raw bootstrap input. Throws FRAMEWORK_INVALID_CONFIGURATION. */
export function resolveConfig(input: unknown): ResolvedBotConfig {
  const parsed = BotOptionsSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
    );
    throw new FrameworkError({
      code: "FRAMEWORK_INVALID_CONFIGURATION",
      category: "Config",
      message: `Invalid bot configuration: ${issues.join("; ")}`,
      context: { subsystem: "config", event: "config.validate" },
      diagnostic: {
        likelyCause:
          "A required option is missing or has the wrong shape (often DISCORD_TOKEN is unset).",
        suggestedInvestigation: [
          "Ensure DISCORD_TOKEN is set in the environment and passed as token.",
          "Check shutdownTimeoutMs is a positive integer if overridden.",
        ],
      },
    });
  }
  return parsed.data;
}
