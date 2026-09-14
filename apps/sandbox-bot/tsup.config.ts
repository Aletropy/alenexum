import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node22",
  // Unbundled output preserves the src/ directory layout so the bootstrap
  // loader can scan definition folders in production, not just under tsx.
  bundle: false,
});
