import { Writable } from "node:stream";
import {
  autocompleteInteraction,
  buttonInteraction,
  chatInputInteraction,
  contextMenuInteraction,
  type FakeInteraction,
  type FakeInteractionOptions,
  modalInteraction,
  type NonCommandOptions,
} from "./fakes.js";

/**
 * Integration harness: dispatch helpers plus structured-log capture.
 * Intentionally dependency-free — it drives the minimal `TestBotLike`
 * surface structurally, so `@alenexum/testing` never depends on
 * `@alenexum/core` (no workspace cycle). Core contract-tests the
 * compatibility (`Bot` satisfies `TestBotLike`).
 */
export interface TestDispatchResult {
  readonly ok: boolean;
  readonly command: string;
  readonly durationMs: number;
  readonly requestId: string;
  readonly error?: unknown;
}

export interface TestBotLike {
  handleInteraction(
    interaction: unknown,
    client?: unknown,
  ): Promise<TestDispatchResult>;
}

export class LogCapture extends Writable {
  private raw = "";

  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.raw += String(chunk);
    callback();
  }

  text(): string {
    return this.raw;
  }

  lines(): Record<string, unknown>[] {
    return this.raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  events(name: string): Record<string, unknown>[] {
    return this.lines().filter((line) => line.event === name);
  }

  clear(): void {
    this.raw = "";
  }
}

export interface Dispatched {
  readonly result: TestDispatchResult;
  readonly interaction: FakeInteraction;
}

export async function dispatchChatInput(
  bot: TestBotLike,
  commandName: string,
  options: Omit<
    FakeInteractionOptions,
    "chatInput" | "kinds" | "commandName"
  > = {},
): Promise<Dispatched> {
  const interaction = chatInputInteraction(commandName, options);
  const result = await bot.handleInteraction(interaction);
  return { result, interaction };
}

export async function dispatchButton(
  bot: TestBotLike,
  customId: string,
  options: NonCommandOptions = {},
): Promise<Dispatched> {
  const interaction = buttonInteraction(customId, options);
  const result = await bot.handleInteraction(interaction);
  return { result, interaction };
}

export async function dispatchModal(
  bot: TestBotLike,
  customId: string,
  fieldValues: Record<string, string> = {},
  options: NonCommandOptions = {},
): Promise<Dispatched> {
  const interaction = modalInteraction(customId, fieldValues, options);
  const result = await bot.handleInteraction(interaction);
  return { result, interaction };
}

export async function dispatchAutocomplete(
  bot: TestBotLike,
  commandName: string,
  focused: { name: string; value: string | number },
  optionValues: Record<string, unknown> = {},
): Promise<Dispatched> {
  const interaction = autocompleteInteraction(
    commandName,
    focused,
    optionValues,
  );
  const result = await bot.handleInteraction(interaction);
  return { result, interaction };
}

export async function dispatchContextMenu(
  bot: TestBotLike,
  type: "user" | "message",
  name: string,
  options: NonCommandOptions = {},
): Promise<Dispatched> {
  const interaction = contextMenuInteraction(type, name, options);
  const result = await bot.handleInteraction(interaction);
  return { result, interaction };
}
