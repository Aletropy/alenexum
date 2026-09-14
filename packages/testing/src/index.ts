/**
 * `@nexum/testing` — fakes and integration harness for testing
 * bots built on the framework. No network, no tokens, deterministic.
 *
 * Test pyramid: fast unit + type tests (vitest, colocated), integration
 * through this harness, a small live set in `apps/sandbox-bot`, benchmarks
 * via `vitest bench`. Every important bugfix ships with a regression test —
 * see `docs` in the README.
 */

export {
  autocompleteInteraction,
  buttonInteraction,
  chatInputInteraction,
  contextMenuInteraction,
  createFakeInteraction,
  FakeInteraction,
  type FakeInteractionOptions,
  FakeOptionResolver,
  modalInteraction,
  type NonCommandOptions,
  selectInteraction,
} from "./fakes.js";
export {
  type Dispatched,
  dispatchAutocomplete,
  dispatchButton,
  dispatchChatInput,
  dispatchContextMenu,
  dispatchModal,
  LogCapture,
  type TestBotLike,
  type TestDispatchResult,
} from "./harness.js";
