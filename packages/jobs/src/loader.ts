import {
  type FrameworkLogger,
  type LoadOptions,
  type LoadReport,
  loadDefinitions,
} from "@nexum/core";
import type { JobDefinition } from "./jobs.js";

/**
 * Bulk-register every job default-exported from a directory (single job or
 * array per file). Same bootstrap semantics as the core loaders: sorted
 * files, validated by `JobScheduler.register`, fail-fast with file context.
 */
export async function loadJobs(
  scheduler: { register(definition: JobDefinition): unknown },
  logger: FrameworkLogger,
  dir: string,
  options: LoadOptions = {},
): Promise<LoadReport> {
  return loadDefinitions({ logger }, dir, {
    ...options,
    kind: "job",
    register: (value) => {
      const definition = value as JobDefinition;
      scheduler.register(definition);
      return [definition.name];
    },
  });
}
