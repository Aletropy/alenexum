// Intentionally malformed: the loader must reject this at runtime while
// TypeScript stays happy (the framework validates, types do not).
export default { name: 123, description: "bad", execute: "not-a-function" };
