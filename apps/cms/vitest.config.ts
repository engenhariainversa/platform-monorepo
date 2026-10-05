import { defineConfig } from "vitest/config";

// Only pure helpers are unit-tested in the CMS; pages are verified in the browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts"],
  },
});
