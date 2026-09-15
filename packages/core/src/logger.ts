import pino, { type DestinationStream } from "pino";

export type FrameworkLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/** Structured bindings attached to every log line. */
export interface FrameworkLogBindings {
  subsystem?: string | undefined;
  event?: string | undefined;
  command?: string | undefined;
  interactionId?: string | undefined;
  guildId?: string | null | undefined;
  channelId?: string | null | undefined;
  userId?: string | null | undefined;
  shardId?: string | number | null | undefined;
  requestId?: string | undefined;
  plugin?: string | undefined;
  module?: string | undefined;
  durationMs?: number | undefined;
  error?: unknown;
  [key: string]: unknown;
}

export interface FrameworkLogger {
  trace(bindings: FrameworkLogBindings, message: string): void;
  debug(bindings: FrameworkLogBindings, message: string): void;
  info(bindings: FrameworkLogBindings, message: string): void;
  warn(bindings: FrameworkLogBindings, message: string): void;
  error(bindings: FrameworkLogBindings, message: string): void;
  fatal(bindings: FrameworkLogBindings, message: string): void;
  child(bindings: FrameworkLogBindings): FrameworkLogger;
}

export interface CreateLoggerOptions {
  level?: FrameworkLogLevel;
  /** Human-readable output for local dev. JSON (machine-readable) by default. */
  pretty?: boolean;
  name?: string;
  /** Injection point for tests: capture serialized lines instead of stdout. */
  destination?: DestinationStream;
}

/**
 * Fields that must never appear in logs. Tokens and credentials are
 * replaced with `[REDACTED]` by pino before serialization.
 */
const REDACT_PATHS = [
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "err.token",
  "error.token",
];

function wrap(base: pino.Logger): FrameworkLogger {
  return {
    trace: (bindings, message) => {
      base.trace(bindings, message);
    },
    debug: (bindings, message) => {
      base.debug(bindings, message);
    },
    info: (bindings, message) => {
      base.info(bindings, message);
    },
    warn: (bindings, message) => {
      base.warn(bindings, message);
    },
    error: (bindings, message) => {
      base.error(bindings, message);
    },
    fatal: (bindings, message) => {
      base.fatal(bindings, message);
    },
    child: (bindings) => wrap(base.child(bindings)),
  };
}

export function createLogger(
  options: CreateLoggerOptions = {},
): FrameworkLogger {
  const { level = "info", pretty = false, name = "alenexum" } = options;
  const baseOptions = {
    level,
    name,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  };
  let base: pino.Logger;
  if (options.destination !== undefined) {
    base = pino(baseOptions, options.destination);
  } else if (pretty) {
    base = pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, singleLine: true },
      },
    });
  } else {
    base = pino(baseOptions);
  }
  return wrap(base);
}
