import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";

const CREATE = `mutation ($name: String!, $expiresIn: ApiKeyExpiry!) {
  createApiKey(name: $name, expiresIn: $expiresIn) { token apiKey { id name prefix expiresAt revokedAt } }
}`;
const LIST = `{ apiKeys { id name prefix lastUsedAt revokedAt } }`;
const REVOKE = `mutation ($id: ID!) { revokeApiKey(id: $id) { id revokedAt } }`;

// 1×1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("API keys over GraphQL", () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);

  it("creates, lists and revokes keys with a CMS session", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const created = await gql(app, CREATE, { name: "Live #12", expiresIn: "ONE_HOUR" }, jwt);
    const { token, apiKey } = created.data.createApiKey;
    expect(token).toMatch(/^ei_/);
    expect(apiKey.prefix).toBe(token.slice(3, 11));

    const listed = await gql(app, LIST, undefined, jwt);
    expect(listed.data.apiKeys).toHaveLength(1);
    expect(listed.data.apiKeys[0]).not.toHaveProperty("token");

    const revoked = await gql(app, REVOKE, { id: apiKey.id }, jwt);
    expect(revoked.data.revokeApiKey.revokedAt).not.toBeNull();
  });

  it("refuses key management and other JWT-only operations to an API key", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const { token } = (await gql(app, CREATE, { name: "k", expiresIn: "ONE_HOUR" }, jwt)).data.createApiKey;

    expect(errorCode(await gql(app, LIST, undefined, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, CREATE, { name: "x", expiresIn: "ONE_HOUR" }, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, "{ me { id } }", undefined, token))).toBe("UNAUTHENTICATED");
  });

  it("refuses key management to roles without the apiKeys permission", async () => {
    const jwt = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LIST, undefined, jwt))).toBe("FORBIDDEN");
  });

  it("accepts an API key on POST /uploads, and rejects a revoked one", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const { token, apiKey } = (await gql(app, CREATE, { name: "k", expiresIn: "ONE_HOUR" }, jwt)).data.createApiKey;

    const ok = await request(app.getHttpServer())
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/^\/uploads\/.+\.png$/);

    await gql(app, REVOKE, { id: apiKey.id }, jwt);
    const denied = await request(app.getHttpServer())
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG, { filename: "dot.png", contentType: "image/png" });
    expect(denied.status).toBe(401);
    expect(denied.body.message).toBe("Chave revogada");
  });
});
