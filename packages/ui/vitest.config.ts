import { defineConfig } from "vitest/config";

// Renderer smoke tests use react-dom/server, so a DOM environment is not
// needed; the automatic JSX runtime matches tsconfig's "react-jsx".
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
