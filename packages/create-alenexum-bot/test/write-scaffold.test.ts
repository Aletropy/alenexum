import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isNonEmptyDir, writeScaffold } from "../src/scaffold.js";

describe("writeScaffold", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("refuses to write into a non-empty directory without force", () => {
    dir = mkdtempSync(join(tmpdir(), "create-alenexum-bot-"));
    writeFileSync(join(dir, "existing.txt"), "hi");
    expect(isNonEmptyDir(dir)).toBe(true);
    expect(() =>
      writeScaffold(dir as string, [{ path: "a.txt", content: "b" }], {
        force: false,
      }),
    ).toThrow(/is not empty/);
  });

  it("overwrites a non-empty directory with force", () => {
    dir = mkdtempSync(join(tmpdir(), "create-alenexum-bot-"));
    writeFileSync(join(dir, "existing.txt"), "hi");
    expect(() =>
      writeScaffold(dir as string, [{ path: "a.txt", content: "b" }], {
        force: true,
      }),
    ).not.toThrow();
    expect(readFileSync(join(dir as string, "a.txt"), "utf8")).toBe("b");
  });

  it("creates nested directories and writes file mode when given", () => {
    dir = mkdtempSync(join(tmpdir(), "create-alenexum-bot-"));
    writeScaffold(
      dir,
      [
        { path: "src/nested/file.ts", content: "export {};" },
        { path: ".env", content: "TOKEN=x\n", mode: 0o600 },
      ],
      { force: false },
    );
    expect(readFileSync(join(dir, "src/nested/file.ts"), "utf8")).toBe(
      "export {};",
    );
    const mode = statSync(join(dir, ".env")).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
