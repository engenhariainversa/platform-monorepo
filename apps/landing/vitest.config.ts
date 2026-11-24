import { defineConfig } from "vitest/config";

// Pure helpers and route handlers (with their data mocked) are unit-tested in
// the landing; pages are verified in the browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
  },
});
