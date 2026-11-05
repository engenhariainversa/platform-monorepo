import { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { closeCodeOf, listen, openSocket, wsClient, wsRequest } from "../../test/ws";

const CREATE_KEY = `mutation { createApiKey(name: "ws", expiresIn: ONE_HOUR) { token apiKey { id } } }`;
const REVOKE_KEY = `mutation ($id: ID!) { revokeApiKey(id: $id) { id } }`;
const DECKS = `{ presentations { id } }`;

describe("graphql-ws transport", () => {
  let app: INestApplication;
  let url: string;
  const disposables: { dispose(): void | Promise<void> }[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDatabase);
  afterEach(async () => {
    delete process.env.CORS_ORIGINS;
    await Promise.all(disposables.splice(0).map((c) => c.dispose()));
  });

  const client = (params?: Record<string, unknown>, headers?: Record<string, string>) => {
    const c = wsClient(url, params, headers);
    disposables.push(c);
    return c;
  };

  it("answers anonymous operations over the socket", async () => {
    const res = await wsRequest(client(), "{ hello }");
    expect(res.data?.hello).toContain("Engenhariainversa");
    expect(errorCode(await wsRequest(client(), "{ me { id } }"))).toBe("UNAUTHENTICATED");
  });

  it("authenticates a JWT sent in connectionParams", async () => {
    const user = await createUser({ admin: true });
    const res = await wsRequest(client({ authorization: `Bearer ${jwtFor(app, user)}` }), "{ me { id } }");
    expect(res.data?.me.id).toBe(user.id);
  });

  it("refuses a socket with an invalid credential (4403)", async () => {
    expect(await closeCodeOf(url, { authorization: "Bearer not-a-token" })).toBe(4403);
    expect(await closeCodeOf(url, { authorization: "Bearer ei_unknown" })).toBe(4403);
  });

  it("validates the credential again on every operation", async () => {
    const jwt = jwtFor(app, await createUser({ admin: true }));
    const key = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey;
    // Eager socket: a lazy client would close after the first operation and
    // reconnect, so onConnect (not the guards) would refuse the revoked key.
    const { client: socket } = await openSocket(url, { authorization: `Bearer ${key.token}` });
    disposables.push(socket);
    expect((await wsRequest(socket, DECKS)).data?.presentations).toEqual([]);

    await gql(app, REVOKE_KEY, { id: key.apiKey.id }, jwt);
    const after = await wsRequest(socket, DECKS);
    expect(errorCode(after)).toBe("UNAUTHENTICATED");
    expect(after.errors?.[0].message).toBe("Chave revogada");
  });

  it("checks Origin against CORS_ORIGINS, letting non-browser clients through", async () => {
    process.env.CORS_ORIGINS = "https://cms.test, https://site.test";
    expect(await closeCodeOf(url, {}, { Origin: "https://evil.test" })).toBe(4403);
    const allowed = await openSocket(url, {}, { Origin: "https://site.test" });
    disposables.push(allowed.client);
    const noOrigin = await openSocket(url);
    disposables.push(noOrigin.client);
  });

  it("caps concurrent sockets per IP at 10 (4429) and frees the slot on close", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.7" };
    const open = [];
    for (let i = 0; i < 10; i++) open.push(await openSocket(url, {}, headers));
    disposables.push(...open.map((o) => o.client));
    expect(await closeCodeOf(url, {}, headers)).toBe(4429);

    await open[0].client.dispose();
    await open[0].closed;
    const again = await openSocket(url, {}, headers);
    disposables.push(again.client);
  });
});
