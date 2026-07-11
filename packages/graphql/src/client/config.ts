/**
 * Shared API location, resolved once so every consumer — the Apollo endpoint
 * and the upload URLs — agrees on the same host.
 *
 * Deployment configures `NEXT_PUBLIC_API_URL` as the full GraphQL endpoint
 * (e.g. `http://localhost:4050/graphql`). We split it into:
 *   - `BASE_URL`     — the host that serves both GraphQL and uploads
 *   - `GRAPHQL_PATH` — the endpoint path appended to `BASE_URL`
 * so uploads can reuse the host without carrying the `/graphql` suffix.
 */

/** Host serving both GraphQL and uploads, e.g. `http://localhost:4050`. */
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Endpoint path appended to `BASE_URL`, e.g. `/graphql`. */
export const GRAPHQL_PATH = process.env.NEXT_PUBLIC_GRAPHQL_PATH ?? "";

/** Fully-qualified GraphQL endpoint, `BASE_URL` + `GRAPHQL_PATH`. */
export const GRAPHQL_URL = `${BASE_URL}${GRAPHQL_PATH}`;
