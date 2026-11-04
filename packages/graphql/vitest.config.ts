import { defineConfig } from "vitest/config";

// Only pure helpers and reducers are unit-tested here; hooks are verified in the browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
