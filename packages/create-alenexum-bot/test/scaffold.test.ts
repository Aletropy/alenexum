import { describe, expect, it } from "vitest";
import type { Features, ScaffoldOptions } from "../src/options.js";
import { planScaffold, RENAME } from "../src/scaffold.js";

function baseOptions(
  overrides: Partial<ScaffoldOptions> = {},
): ScaffoldOptions {
  return {
    projectName: "my-bot",
    targetDir: "/tmp/unused",
    packageManager: "npm",
    intents: "minimal",
    deployMode: "skip",
    guildId: undefined,
    logLevel: "info",
    features: { telemetry: false, jobs: false, testing: false },
    token: undefined,
    install: true,
    git: true,
    force: false,
    ...overrides,
  };
}

const FEATURE_COMBINATIONS: Features[] = [];
for (const telemetry of [false, true]) {
  for (const jobs of [false, true]) {
    for (const testing of [false, true]) {
      FEATURE_COMBINATIONS.push({ telemetry, jobs, testing });
    }
  }
}

describe("planScaffold", () => {
  it.each(FEATURE_COMBINATIONS)(
    "renders a valid, fully-resolved project for features=%o",
    (features) => {
      for (const intents of ["minimal", "standard"] as const) {
        const files = planScaffold(baseOptions({ features, intents }));

        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
          expect(file.content).not.toMatch(/\{\{|\}\}/);
        }

        const pkg = files.find((f) => f.path === "package.json");
        expect(pkg).toBeDefined();
        const parsed = JSON.parse(pkg?.content ?? "{}") as {
          dependencies: Record<string, string>;
          devDependencies: Record<string, string>;
          scripts: Record<string, string>;
        };
        expect(parsed.dependencies["@alenexum/core"]).toBeDefined();
        expect(parsed.dependencies["@alenexum/discord"]).toBeDefined();
        expect("@alenexum/jobs" in parsed.dependencies).toBe(features.jobs);
        expect("@alenexum/telemetry" in parsed.dependencies).toBe(
          features.telemetry,
        );
        expect("@alenexum/testing" in parsed.devDependencies).toBe(
          features.testing,
        );
        expect("vitest" in parsed.devDependencies).toBe(features.testing);
        expect("test" in parsed.scripts).toBe(features.testing);

        const paths = files.map((f) => f.path);
        expect(paths).toContain(".gitignore");
        expect(paths).toContain(".env.example");
        expect(paths).not.toContain("_gitignore");
        expect(paths).not.toContain("env.example");

        expect(paths.includes("src/jobs/heartbeat.ts")).toBe(features.jobs);
        expect(paths.includes("test/ping.test.ts")).toBe(features.testing);
      }
    },
  );

  it("omits .env when no token or guildId was collected", () => {
    const files = planScaffold(baseOptions());
    expect(files.some((f) => f.path === ".env")).toBe(false);
  });

  it("writes .env with mode 0o600 when a token was collected", () => {
    const files = planScaffold(baseOptions({ token: "secret" }));
    const env = files.find((f) => f.path === ".env");
    expect(env).toBeDefined();
    expect(env?.mode).toBe(0o600);
    expect(env?.content).toContain("DISCORD_TOKEN=secret");
    expect(env?.content).not.toContain("secret\nsecret");
  });

  it("writes .env with mode 0o600 when only a guildId was collected", () => {
    const files = planScaffold(
      baseOptions({ guildId: "123456789012345678", deployMode: "guild" }),
    );
    const env = files.find((f) => f.path === ".env");
    expect(env).toBeDefined();
    expect(env?.mode).toBe(0o600);
    expect(env?.content).toContain("GUILD_ID=123456789012345678");
    expect(env?.content).toContain("DISCORD_TOKEN=\n");
  });

  it("applies the RENAME map", () => {
    expect(RENAME._gitignore).toBe(".gitignore");
    expect(RENAME["env.example"]).toBe(".env.example");
  });
});
