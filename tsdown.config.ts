import { defineConfig } from "tsdown";

export default defineConfig([
  // ESM build with types
  {
    entry: ["./src/index.ts"],
    platform: "neutral",
    dts: true,
    format: "esm",
  },
  // CJS build for VS Code extension host (so require('vscode') works)
  {
    entry: ["./src/index.ts"],
    platform: "node",
    dts: false,
    format: "cjs",
  },
]);
