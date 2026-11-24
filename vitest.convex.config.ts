import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The default forks/threads pools crash on this setup ("Cannot read properties
    // of undefined (reading 'config')" at the first describe); vmThreads works.
    pool: "vmThreads",
    environment: "edge-runtime",
    include: ["tests/convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
