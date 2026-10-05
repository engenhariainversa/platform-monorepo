/**
 * Tests run against a sibling database of the dev one (same server, name
 * `ei_test`), so they never touch the data you use in the CMS.
 */
export function testDatabaseUrl(base = process.env.DATABASE_URL): string {
  if (!base) throw new Error("DATABASE_URL must be set to run the backend tests");
  const url = new URL(base);
  url.pathname = "/ei_test";
  return url.toString();
}

export function adminDatabaseUrl(base = process.env.DATABASE_URL): string {
  if (!base) throw new Error("DATABASE_URL must be set to run the backend tests");
  const url = new URL(base);
  url.pathname = "/postgres";
  return url.toString();
}
