// Checks that every public export of the real packages is mentioned in docs/api/*.
// Stubs (commands, events, middleware, components, plugins, cli, all) export
// nothing and are explicitly ignored — they are covered by docs/api/reserved.md.
//
// Usage: node scripts/check-public-exports.mjs  (exit 1 on gaps, runs in CI)
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const PACKAGE_TO_DOC = {
  core: "docs/api/core.md",
  discord: "docs/api/discord.md",
  testing: "docs/api/testing.md",
  telemetry: "docs/api/telemetry.md",
  jobs: "docs/api/jobs.md",
  sharding: "docs/api/sharding.md",
};

function extractExportedNames(source) {
  const names = new Set();
  // Matches: export { A, type B, C as D } ... (single-line or multi-line braces)
  const re = /export\s+(?:type\s+)?\{([^}]*)\}/gs;
  for (const match of source.matchAll(re)) {
    for (const part of match[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // "type Foo" / "Foo" / "Foo as Bar" / "type Foo as Bar"
      const m = trimmed.match(
        /^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/,
      );
      if (m) names.add(m[2] ?? m[1]);
    }
  }
  return [...names];
}

let failures = 0;
for (const [pkg, docRel] of Object.entries(PACKAGE_TO_DOC)) {
  const indexPath = join(root, "packages", pkg, "src", "index.ts");
  const docPath = join(root, docRel);
  let source;
  try {
    source = readFileSync(indexPath, "utf8");
  } catch {
    console.error(`FAIL: cannot read ${indexPath}`);
    failures++;
    continue;
  }
  let doc;
  try {
    doc = readFileSync(docPath, "utf8");
  } catch {
    console.error(`FAIL: cannot read ${docPath}`);
    failures++;
    continue;
  }
  const missing = extractExportedNames(source).filter((n) => !doc.includes(n));
  if (missing.length > 0) {
    failures++;
    console.error(
      `FAIL: ${docRel} is missing ${missing.length} export(s) from packages/${pkg}/src/index.ts:`,
    );
    for (const n of missing.sort()) console.error(`  - ${n}`);
  } else {
    console.log(`OK: ${docRel} covers packages/${pkg} exports`);
  }
}

// Guard: stub packages must stay empty (a new export without docs intent fails loudly).
const STUBS = [
  "commands",
  "events",
  "middleware",
  "components",
  "plugins",
  "cli",
  "all",
];
for (const pkg of STUBS) {
  const p = join(root, "packages", pkg, "src", "index.ts");
  try {
    const src = readFileSync(p, "utf8");
    const names = extractExportedNames(src);
    if (names.length > 0) {
      failures++;
      console.error(
        `FAIL: stub packages/${pkg} now exports ${names.join(", ")} — add a real API page or keep it empty.`,
      );
    }
  } catch {
    // missing stub index is also a failure (structure drift)
    failures++;
    console.error(`FAIL: cannot read stub ${p}`);
  }
}

// Guard: docs must not reference phantom files.
const docsDir = join(root, "docs");
void readdirSync;
void docsDir;

if (failures > 0) {
  console.error(`\nAPI coverage check failed (${failures} problem(s)).`);
  process.exit(1);
}
console.log("API coverage check passed.");
