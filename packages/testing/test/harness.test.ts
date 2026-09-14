import { describe, expect, it } from "vitest";
import type { FakeInteraction } from "../src/fakes.js";
import {
  dispatchAutocomplete,
  dispatchButton,
  dispatchChatInput,
  dispatchContextMenu,
  dispatchModal,
  LogCapture,
  type TestBotLike,
  type TestDispatchResult,
} from "../src/harness.js";

/** Stub proving the harness only needs the structural surface. */
class StubBot implements TestBotLike {
  readonly seen: unknown[] = [];
  constructor(
    private readonly reply: (interaction: FakeInteraction) => void = () => {},
  ) {}

  async handleInteraction(interaction: unknown): Promise<TestDispatchResult> {
    this.seen.push(interaction);
    this.reply(interaction as FakeInteraction);
    return { ok: true, command: "stub", durationMs: 1, requestId: "r1" };
  }
}

describe("dispatch helpers", () => {
  it("route each interaction kind to handleInteraction", async () => {
    const bot = new StubBot();
    const chat = await dispatchChatInput(bot, "ping", {
      optionValues: { a: 1 },
    });
    expect(chat.result).toMatchObject({ ok: true, command: "stub" });
    expect(chat.interaction.commandName).toBe("ping");
    expect(bot.seen).toHaveLength(1);

    const button = await dispatchButton(bot, "vote:yes");
    expect(button.interaction.customId).toBe("vote:yes");
    expect(button.interaction.isButton()).toBe(true);

    const modal = await dispatchModal(bot, "form", { message: "hi" });
    expect(modal.interaction.fields.getTextInputValue("message")).toBe("hi");

    const auto = await dispatchAutocomplete(bot, "search", {
      name: "q",
      value: "a",
    });
    expect(auto.interaction.options.getFocused(true)).toEqual({
      name: "q",
      value: "a",
    });

    const menu = await dispatchContextMenu(bot, "user", "Hi");
    expect(menu.interaction.isUserContextMenuCommand()).toBe(true);
    expect(bot.seen).toHaveLength(5);
  });
});

describe("LogCapture", () => {
  it("parses JSON lines and filters events", () => {
    const logs = new LogCapture();
    logs.write(
      `${JSON.stringify({ event: "a", n: 1 })}\n${JSON.stringify({ event: "b" })}\n`,
    );
    expect(logs.events("a")).toEqual([{ event: "a", n: 1 }]);
    expect(logs.lines()).toHaveLength(2);
    expect(logs.text()).toContain('"event":"b"');
    logs.clear();
    expect(logs.lines()).toEqual([]);
    expect(logs.text()).toBe("");
  });
});
