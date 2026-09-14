/**
 * Instrumentation hooks: distributed tracing and dispatch observation.
 *
 * Both are structural and optional. When no tracer/observer is configured,
 * dispatch pays a single `undefined` check — small bots pay nothing.
 * A real OpenTelemetry tracer satisfies `TracerLike` structurally (one
 * documented cast at the call site); the framework never takes an OTel SDK
 * dependency.
 */

export const SPAN_UNSET = 0;
export const SPAN_OK = 1;
export const SPAN_ERROR = 2;

export type SpanStatusCode =
  | typeof SPAN_UNSET
  | typeof SPAN_OK
  | typeof SPAN_ERROR;

export type SpanAttributeValue = string | number | boolean;

export interface SpanLike {
  setAttribute(key: string, value: SpanAttributeValue): void;
  setStatus(status: { code: SpanStatusCode; message?: string }): void;
  recordException(error: unknown): void;
  end(): void;
}

export interface StartSpanOptions {
  attributes?: Record<string, SpanAttributeValue> | undefined;
}

export interface TracerLike {
  startSpan(name: string, options?: StartSpanOptions): SpanLike;
}

export type DispatchKind =
  | "command"
  | "component"
  | "modal"
  | "autocomplete"
  | "contextmenu";

export type DispatchOutcome = "success" | "denied" | "error";

export interface DispatchObservation {
  readonly route: string;
  readonly kind: DispatchKind;
  readonly outcome: DispatchOutcome;
  readonly durationMs: number;
  readonly requestId: string;
  readonly errorCode?: string | undefined;
  /** Guard name for denied dispatches. */
  readonly guard?: string | undefined;
}

/** Sink for per-dispatch observations (metrics, audit trails). Never throws out. */
export interface DispatchObserver {
  observe(observation: DispatchObservation): void;
}
