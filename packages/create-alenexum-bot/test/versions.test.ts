import { describe, expect, it } from "vitest";
import { TEMPLATE_VERSIONS } from "../src/versions.js";

describe("TEMPLATE_VERSIONS", () => {
  it("pins a version string for every framework and tooling dependency", () => {
    const keys = [
      "alenexumCore",
      "alenexumDiscord",
      "alenexumTelemetry",
      "alenexumJobs",
      "alenexumTesting",
      "discordJs",
      "dotenv",
      "tsx",
      "tsup",
      "typescript",
      "vitest",
      "biome",
      "nodeTypes",
    ] as const;
    for (const key of keys) {
      expect(typeof TEMPLATE_VERSIONS[key]).toBe("string");
      expect(TEMPLATE_VERSIONS[key].length).toBeGreaterThan(0);
    }
  });
});
