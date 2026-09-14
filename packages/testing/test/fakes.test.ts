import { describe, expect, it } from "vitest";
import {
  autocompleteInteraction,
  buttonInteraction,
  chatInputInteraction,
  contextMenuInteraction,
  createFakeInteraction,
  modalInteraction,
  selectInteraction,
} from "../src/fakes.js";

describe("interaction factories", () => {
  it("build each kind with the right guards", () => {
    expect(chatInputInteraction("ping").isChatInputCommand()).toBe(true);
    const button = buttonInteraction("vote:yes");
    expect(button.isButton()).toBe(true);
    expect(button.isChatInputCommand()).toBe(false);
    expect(button.customId).toBe("vote:yes");
    const select = selectInteraction("color", ["red"]);
    expect(select.isStringSelectMenu()).toBe(true);
    expect(select.values).toEqual(["red"]);
    const modal = modalInteraction("form", { message: "hi" });
    expect(modal.isModalSubmit()).toBe(true);
    expect(modal.fields.getTextInputValue("message")).toBe("hi");
    const auto = autocompleteInteraction(
      "search",
      { name: "q", value: "a" },
      { q: "a" },
    );
    expect(auto.isAutocomplete()).toBe(true);
    expect(auto.options.getFocused(true)).toEqual({ name: "q", value: "a" });
    const userMenu = contextMenuInteraction("user", "Get avatar");
    expect(userMenu.isUserContextMenuCommand()).toBe(true);
    expect(userMenu.isMessageContextMenuCommand()).toBe(false);
    const messageMenu = contextMenuInteraction("message", "Quote");
    expect(messageMenu.isMessageContextMenuCommand()).toBe(true);
    expect(createFakeInteraction().commandName).toBe("ping");
  });
});
