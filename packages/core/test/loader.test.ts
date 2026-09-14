import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dispatchAutocomplete,
  dispatchButton,
  dispatchChatInput,
  dispatchContextMenu,
  dispatchModal,
  LogCapture,
} from "@alenexum/testing";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { FrameworkError } from "../src/errors.js";
import {
  type LoadReport,
  loadAutocomplete,
  loadCommands,
  loadComponents,
  loadContextMenus,
  loadDefinitions,
  loadGuards,
  loadMiddleware,
  loadModals,
  loadModules,
  loadPlugins,
} from "../src/loader.js";
import { createLogger } from "../src/logger.js";

function fixtures(sub: string): string {
  return fileURLToPath(new URL(`./fixtures/loader/${sub}`, import.meta.url));
}

function testBot(): { bot: Bot; dest: LogCapture } {
  const dest = new LogCapture();
  const bot = new Bot({
    token: "test-token",
    logger: createLogger({ level: "debug", destination: dest }),
  });
  return { bot, dest };
}

async function loadError(promise: Promise<unknown>): Promise<FrameworkError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(FrameworkError);
    return error as FrameworkError;
  }
  throw new Error("expected load to throw");
}

describe("loadCommands", () => {
  it("loads single and array defaults with a sorted report", async () => {
    const { bot, dest } = testBot();
    const report: LoadReport = await loadCommands(
      bot,
      fixtures("commands-valid"),
    );
    expect(report.dir).toBe(fixtures("commands-valid"));
    expect(report.loaded.map((entry) => entry.key)).toEqual([
      "multi-one",
      "multi-two",
      "ping",
    ]);
    expect(report.loaded.every((entry) => entry.kind === "command")).toBe(true);
    const { result, interaction } = await dispatchChatInput(bot, "ping");
    expect(result).toMatchObject({ ok: true });
    expect(interaction.replies).toEqual(["Pong!"]);
    expect(dest.events("directory.loaded")).toHaveLength(1);
  });

  it("rejects malformed defaults with file context", async () => {
    const { bot } = testBot();
    const error = await loadError(
      loadCommands(bot, fixtures("commands-invalid")),
    );
    expect(error.code).toBe("FRAMEWORK_INVALID_CONFIGURATION");
    expect(error.message).toContain("invalid.ts");
  });

  it("rejects files without a default export", async () => {
    const { bot } = testBot();
    const error = await loadError(
      loadCommands(bot, fixtures("commands-no-default")),
    );
    expect(error.message).toContain("no-default.ts");
    expect(error.message).toContain("default export");
  });

  it("surfaces duplicate registrations with the offending file", async () => {
    const { bot } = testBot();
    const error = await loadError(loadCommands(bot, fixtures("duplicates")));
    expect(error.message).toContain("two.ts");
    expect(error.message).toContain("Duplicate");
    expect(error.cause).toBeInstanceOf(FrameworkError);
  });

  it("fails fast before later files register", async () => {
    const { bot } = testBot();
    const error = await loadError(loadCommands(bot, fixtures("failfast")));
    expect(error.message).toContain("a-bad.ts");
    expect(bot.getCommandNames()).toEqual([]);
  });

  it("wraps import-time throws with file context", async () => {
    const { bot } = testBot();
    const error = await loadError(loadCommands(bot, fixtures("import-fail")));
    expect(error.message).toContain("broken.ts");
    expect(error.message).toContain("threw during import");
    expect((error.cause as Error).message).toContain("explodes at import");
  });

  it("rejects missing directories", async () => {
    const { bot } = testBot();
    const missing = join(fixtures("commands-valid"), "nope");
    const error = await loadError(loadCommands(bot, missing));
    expect(error.code).toBe("FRAMEWORK_INVALID_CONFIGURATION");
    expect(error.message).toContain(missing);
  });

  it("loads nothing from an empty directory", async () => {
    const { bot } = testBot();
    const dir = await mkdtemp(join(tmpdir(), "loader-empty-"));
    try {
      const report = await loadCommands(bot, dir);
      expect(report.loaded).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads empty arrays without error", async () => {
    const { bot } = testBot();
    const report = await loadCommands(bot, fixtures("empty-array"));
    expect(report.loaded).toEqual([]);
    expect(bot.getCommandNames()).toEqual([]);
  });

  it("registers in filename sort order and supports recursive and pattern", async () => {
    const { bot } = testBot();
    const flat = await loadCommands(bot, fixtures("order"));
    expect(flat.loaded.map((entry) => entry.key)).toEqual(["zzz", "aaa"]);

    const { bot: recursiveBot } = testBot();
    const deep = await loadCommands(recursiveBot, fixtures("order"), {
      recursive: true,
    });
    expect(deep.loaded.map((entry) => entry.key).sort()).toEqual([
      "aaa",
      "nested",
      "zzz",
    ]);

    const { bot: filteredBot } = testBot();
    const filtered = await loadCommands(filteredBot, fixtures("order"), {
      pattern: /^a-command\./,
    });
    expect(filtered.loaded.map((entry) => entry.key)).toEqual(["zzz"]);
  });
});

describe("other interaction kinds", () => {
  it("loads components, modals, autocomplete, and context menus", async () => {
    const { bot } = testBot();
    const components = await loadComponents(bot, fixtures("components"));
    expect(components.loaded).toMatchObject([
      { kind: "component", key: "vote" },
    ]);
    const modals = await loadModals(bot, fixtures("modals"));
    expect(modals.loaded).toMatchObject([{ kind: "modal", key: "feedback" }]);
    const autocomplete = await loadAutocomplete(bot, fixtures("autocomplete"));
    expect(autocomplete.loaded).toMatchObject([
      { kind: "autocomplete", key: "search:query" },
    ]);
    const menus = await loadContextMenus(bot, fixtures("context-menus"));
    expect(menus.loaded).toMatchObject([
      { kind: "contextmenu", key: "Inspect" },
    ]);

    const button = await dispatchButton(bot, "vote:yes");
    expect(button.interaction.replies).toEqual(["voted yes"]);
    const modal = await dispatchModal(bot, "feedback", { message: "hi" });
    expect(modal.interaction.replies).toEqual(["got hi"]);
    const auto = await dispatchAutocomplete(bot, "search", {
      name: "query",
      value: "x",
    });
    expect(auto.interaction.respondedChoices).toEqual([
      { name: "x", value: "x" },
    ]);
    const menu = await dispatchContextMenu(bot, "user", "Inspect", {
      targetId: "u1",
    });
    expect(menu.interaction.replies).toEqual(["inspecting u1"]);
  });
});

describe("middleware, guards, plugins, modules", () => {
  it("loads middleware and guards", async () => {
    const { bot } = testBot();
    const middleware = await loadMiddleware(bot, fixtures("middleware"));
    const keys = middleware.loaded.map((entry) => entry.key).sort();
    expect(keys).toContain("requestLogger");
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key !== "")).toBe(true);
    const guards = await loadGuards(bot, fixtures("guards"));
    expect(guards.loaded.map((entry) => entry.key).sort()).toEqual([
      "allow-all",
      "alwaysAllow",
    ]);

    bot.command({
      name: "ping",
      description: "Ping",
      async execute(ctx) {
        await ctx.reply("Pong!");
      },
    });
    const { result } = await dispatchChatInput(bot, "ping");
    expect(result).toMatchObject({ ok: true });
  });

  it("loads plugins and modules with async setup", async () => {
    const { bot } = testBot();
    const plugins = await loadPlugins(bot, fixtures("plugins"));
    expect(plugins.loaded).toMatchObject([
      { kind: "plugin", key: "fixture-plugin" },
    ]);
    const modules = await loadModules(bot, fixtures("modules"));
    expect(modules.loaded).toMatchObject([
      { kind: "module", key: "fixture-module" },
    ]);

    const fromPlugin = await dispatchChatInput(bot, "from-plugin");
    expect(fromPlugin.interaction.replies).toEqual(["plugin"]);
    const fromModule = await dispatchChatInput(bot, "from-module");
    expect(fromModule.interaction.replies).toEqual(["module"]);
  });
});

describe("loadDefinitions", () => {
  it("supports custom kinds through the generic engine", async () => {
    const { bot } = testBot();
    const seen: string[] = [];
    const report = await loadDefinitions(bot, fixtures("commands-valid"), {
      kind: "custom",
      register: (value) => {
        const definition = value as { name: string };
        seen.push(definition.name);
        return [definition.name.toUpperCase()];
      },
    });
    expect(seen.sort()).toEqual(["multi-one", "multi-two", "ping"]);
    expect(report.loaded.every((entry) => entry.kind === "custom")).toBe(true);
    expect(report.loaded.map((entry) => entry.key)).toEqual([
      "MULTI-ONE",
      "MULTI-TWO",
      "PING",
    ]);
    expect(bot.getCommandNames()).toEqual([]);
  });
});
