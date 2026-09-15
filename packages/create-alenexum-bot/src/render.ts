/**
 * A tiny mustache-like template engine for scaffold files.
 *
 * `{{#key}}...{{/key}}` conditional sections resolve first (a truthy value
 * unwraps the body, a falsy one deletes it) so that content — not just
 * text — can differ between feature combinations; several passes handle
 * nested sections. `{{key}}` tokens then substitute string values.
 *
 * Boolean vars exist only to drive `{{#key}}` sections — they are never
 * valid inside a bare `{{key}}` token. Authoring `{{jobs}}` instead of
 * `{{#jobs}}...{{/jobs}}` is a template bug, so it throws rather than
 * silently printing "true"/"false" into a generated file.
 */

export type TemplateVars = Record<string, string | boolean>;

const SECTION_PATTERN = /\{\{#([A-Za-z_]\w*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const TOKEN_PATTERN = /\{\{([A-Za-z_]\w*)\}\}/g;
const MAX_PASSES = 5;

export function renderTemplate(source: string, vars: TemplateVars): string {
  let output = source;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = output.replace(
      SECTION_PATTERN,
      (_match, key: string, body: string) => (vars[key] ? body : ""),
    );
    if (next === output) break;
    output = next;
  }

  const missing = new Set<string>();
  output = output.replace(TOKEN_PATTERN, (match, key: string) => {
    const value = vars[key];
    if (value === undefined || typeof value === "boolean") {
      missing.add(key);
      return match;
    }
    return value;
  });
  if (missing.size > 0) {
    throw new Error(
      `Unresolved template token(s): ${[...missing].sort().join(", ")}.`,
    );
  }
  return output;
}
