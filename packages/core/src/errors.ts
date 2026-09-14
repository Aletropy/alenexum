/**
 * Structured error system.
 *
 * Every framework failure carries a stable machine-readable `code`
 * (`FRAMEWORK_*`), a category, contextual metadata for diagnostics, and an
 * optional actionable diagnostic. Application errors thrown from command
 * handlers are wrapped — never swallowed — so centralized logging always has
 * enough context to answer what failed, where, and what to investigate next.
 */

export const FRAMEWORK_ERROR_CODES = [
  "FRAMEWORK_INVALID_CONFIGURATION",
  "FRAMEWORK_ROUTE_NOT_FOUND",
  "FRAMEWORK_COMMAND_VALIDATION_FAILED",
  "FRAMEWORK_COMMAND_HANDLER_FAILED",
  "FRAMEWORK_MIDDLEWARE_FAILED",
  "FRAMEWORK_PLUGIN_INITIALIZATION_FAILED",
  "FRAMEWORK_LIFECYCLE_HOOK_FAILED",
  "FRAMEWORK_CONNECTOR_START_FAILED",
  "FRAMEWORK_SHARD_OPERATION_FAILED",
  "FRAMEWORK_INTERACTION_ALREADY_ACKNOWLEDGED",
  "FRAMEWORK_SHUTDOWN_TIMEOUT",
  "FRAMEWORK_SERVICE_NOT_FOUND",
  "FRAMEWORK_SERVICE_ALREADY_REGISTERED",
  "FRAMEWORK_INTERNAL",
] as const;

export type FrameworkErrorCode = (typeof FRAMEWORK_ERROR_CODES)[number];

export type FrameworkErrorCategory =
  | "Config"
  | "Validation"
  | "UserInput"
  | "Permission"
  | "Application"
  | "Framework"
  | "DiscordAPI"
  | "RateLimit"
  | "Gateway"
  | "Network"
  | "Database"
  | "Plugin"
  | "Dependency"
  | "Internal"
  | "Unknown";

/** Contextual metadata attached to errors for structured diagnostics. */
export interface FrameworkErrorContext {
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
  [key: string]: unknown;
}

/**
 * Actionable diagnostic. Wording must stay probabilistic ("likely",
 * "possible", "suggested") — the framework reports evidence, not certainty.
 */
export interface FrameworkDiagnostic {
  likelyCause: string;
  suggestedInvestigation: string[];
}

export interface FrameworkErrorInit {
  code: FrameworkErrorCode;
  category: FrameworkErrorCategory;
  message: string;
  context?: FrameworkErrorContext;
  cause?: unknown;
  diagnostic?: FrameworkDiagnostic;
}

export class FrameworkError extends Error {
  readonly code: FrameworkErrorCode;
  readonly category: FrameworkErrorCategory;
  readonly context: FrameworkErrorContext;
  readonly diagnostic?: FrameworkDiagnostic;

  constructor(init: FrameworkErrorInit) {
    super(
      init.message,
      init.cause !== undefined ? { cause: init.cause } : undefined,
    );
    this.name = "FrameworkError";
    this.code = init.code;
    this.category = init.category;
    this.context = init.context ?? {};
    if (init.diagnostic !== undefined) {
      this.diagnostic = init.diagnostic;
    }
  }

  toJSON(): {
    name: string;
    code: FrameworkErrorCode;
    category: FrameworkErrorCategory;
    message: string;
    stack: string | undefined;
    context: FrameworkErrorContext;
    diagnostic: FrameworkDiagnostic | undefined;
  } {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      stack: this.stack,
      context: this.context,
      diagnostic: this.diagnostic,
    };
  }
}

export function isFrameworkError(error: unknown): error is FrameworkError {
  return error instanceof FrameworkError;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown error value";
}

/**
 * Wrap an unknown thrown value in a FrameworkError, preserving the original
 * as `cause`. FrameworkErrors pass through untouched.
 */
export function toFrameworkError(
  code: FrameworkErrorCode,
  category: FrameworkErrorCategory,
  message: string,
  error: unknown,
  context: FrameworkErrorContext = {},
  diagnostic?: FrameworkDiagnostic,
): FrameworkError {
  if (isFrameworkError(error)) {
    return error;
  }
  const init: FrameworkErrorInit = {
    code,
    category,
    message: `${message}: ${messageOf(error)}`,
    context,
    cause: error,
  };
  if (diagnostic !== undefined) {
    init.diagnostic = diagnostic;
  }
  return new FrameworkError(init);
}

/** Minimal JSON-safe error shape for structured logs. Never includes secrets. */
export function serializeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  code?: string;
} {
  if (isFrameworkError(error)) {
    const out: {
      name: string;
      message: string;
      stack?: string;
      code?: string;
    } = {
      name: error.name,
      message: error.message,
      code: error.code,
    };
    if (error.stack !== undefined) {
      out.stack = error.stack;
    }
    return out;
  }
  if (error instanceof Error) {
    const out: {
      name: string;
      message: string;
      stack?: string;
      code?: string;
    } = {
      name: error.name,
      message: error.message,
    };
    if (error.stack !== undefined) {
      out.stack = error.stack;
    }
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === "string" || typeof maybeCode === "number") {
      out.code = String(maybeCode);
    }
    return out;
  }
  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error value",
  };
}

/**
 * Human-readable diagnostic report: code, category, message, known context,
 * cause chain, and actionable next steps. For alerts, CLIs, and support —
 * machines should consume `toJSON()`/`serializeError()` instead. Never
 * includes secrets (context is framework metadata, never tokens).
 */
export function formatFrameworkError(error: unknown): string {
  const lines: string[] = [];
  if (isFrameworkError(error)) {
    lines.push(`[${error.code}] (${error.category}) ${error.message}`);
    const entries = Object.entries(error.context).filter(
      ([, value]) => value !== undefined,
    );
    if (entries.length > 0) {
      lines.push("Context:");
      for (const [key, value] of entries) {
        lines.push(`  ${key}: ${formatContextValue(value)}`);
      }
    }
    appendCause(lines, error.cause, 0);
    if (error.diagnostic !== undefined) {
      lines.push(`Likely cause: ${error.diagnostic.likelyCause}`);
      if (error.diagnostic.suggestedInvestigation.length > 0) {
        lines.push("Suggested investigation:");
        for (const [
          index,
          step,
        ] of error.diagnostic.suggestedInvestigation.entries()) {
          lines.push(`  ${index + 1}. ${step}`);
        }
      }
    }
    return lines.join("\n");
  }
  if (error instanceof Error) {
    lines.push(`${error.name}: ${error.message}`);
    appendCause(lines, error.cause, 0);
    return lines.join("\n");
  }
  return `UnknownError: ${typeof error === "string" ? error : "Unknown error value"}`;
}

function formatContextValue(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  try {
    return JSON.stringify(value) ?? "unserializable";
  } catch {
    return "unserializable";
  }
}

function appendCause(lines: string[], cause: unknown, depth: number): void {
  if (cause === undefined || cause === null || depth >= 3) {
    return;
  }
  const indent = "  ".repeat(depth + 1);
  if (cause instanceof Error) {
    lines.push(`${indent}Caused by ${cause.name}: ${cause.message}`);
    appendCause(lines, cause.cause, depth + 1);
  } else if (typeof cause === "string") {
    lines.push(`${indent}Caused by: ${cause}`);
  } else {
    lines.push(`${indent}Caused by an unknown value`);
  }
}
