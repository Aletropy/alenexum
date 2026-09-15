import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/render.js";

describe("renderTemplate", () => {
  it("substitutes string tokens", () => {
    expect(renderTemplate("Hello {{name}}!", { name: "world" })).toBe(
      "Hello world!",
    );
  });

  it("throws for an unresolved token", () => {
    expect(() => renderTemplate("Hello {{name}}!", {})).toThrow(
      /Unresolved template token\(s\): name/,
    );
  });

  it("keeps a truthy section's body and strips the tags", () => {
    expect(renderTemplate("a{{#on}}b{{/on}}c", { on: true })).toBe("abc");
  });

  it("removes a falsy section entirely", () => {
    expect(renderTemplate("a{{#on}}b{{/on}}c", { on: false })).toBe("ac");
  });

  it("resolves nested sections across multiple passes", () => {
    const source = "{{#outer}}x{{#inner}}y{{/inner}}z{{/outer}}";
    expect(renderTemplate(source, { outer: true, inner: true })).toBe("xyz");
    expect(renderTemplate(source, { outer: true, inner: false })).toBe("xz");
    expect(renderTemplate(source, { outer: false, inner: true })).toBe("");
  });

  it("throws when a boolean var is used as a bare token instead of a section", () => {
    expect(() => renderTemplate("value: {{flag}}", { flag: true })).toThrow(
      /Unresolved template token\(s\): flag/,
    );
  });

  it("reports every unresolved token, sorted", () => {
    expect(() => renderTemplate("{{b}} {{a}}", {})).toThrow(
      "Unresolved template token(s): a, b.",
    );
  });
});
