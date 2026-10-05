import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/test-db-url";

export default defineConfig({
  // SWC instead of esbuild: Nest needs emitDecoratorMetadata.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globalSetup: ["test/global-setup.ts"],
    // One database for all files: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: "test-secret",
      UPLOADS_DIR: "/tmp/ei-test-uploads",
      NODE_ENV: "test",
    },
  },
});
