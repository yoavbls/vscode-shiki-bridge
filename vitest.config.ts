import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/example/**", // Exclude example extension tests
      "**/.{idea,git,cache,output,temp}/**",
    ],
  },
});
