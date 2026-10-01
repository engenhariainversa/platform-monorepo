import { execSync } from "child_process";
import { PrismaClient } from "@repo/database";
import { adminDatabaseUrl, testDatabaseUrl } from "./test-db-url";

/** Creates `ei_test` if needed and applies every migration to it. */
export default async function setup() {
  const admin = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl() } } });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ei_test') AS "exists"`;
    if (!rows[0]?.exists) await admin.$executeRawUnsafe(`CREATE DATABASE ei_test`);
  } finally {
    await admin.$disconnect();
  }

  execSync("pnpm --filter @repo/database db:migrate:deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
