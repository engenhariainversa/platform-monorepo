import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { closeCodeOf, listen, wsClient, wsRequest } from "../../test/ws";

const CREATE_DECK = `mutation ($input: CreatePresentationInput!) { createPresentation(input: $input) { id slug } }`;
const CREATE_LINK = `mutation ($p: ID!, $name: String!, $e: PresenterLinkExpiry!) {
  createPresenterLink(presentationId: $p, name: $name, expiresIn: $e) { url presenterLink { id name prefix expiresAt revokedAt } }
}`;
const LINKS = `query ($p: ID!) { presenterLinks(presentationId: $p) { id name revokedAt } }`;
const REVOKE = `mutation ($id: ID!) { revokePresenterLink(id: $id) { id revokedAt } }`;
const FOR_PRESENTER = `{ presentationForPresenter { id title visibility slideCount slides { id notes hidden } } }`;
const CREATE_KEY = `mutation { createApiKey(name: "k", expiresIn: ONE_HOUR) { token } }`;

const deckInput = {
  title: "Privada",
  slides: [
    { template: "cover", content: { title: "Capa" } },
    { template: "bullets", content: { title: "T", items: ["a"] }, notes: "segredo", hidden: true },
  ],
};

describe("presenter links over GraphQL", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;
  let deckId: string;

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
    deckId = (await gql(app, CREATE_DECK, { input: deckInput }, jwt)).data.createPresentation.id;
  });

  const createLink = async (presentationId = deckId) => {
    const res = await gql(app, CREATE_LINK, { p: presentationId, name: "Evento", e: "TWO_HOURS" }, jwt);
    const { url: linkUrl, presenterLink } = res.data.createPresenterLink;
    return { token: linkUrl.split("#t=")[1] as string, linkUrl: linkUrl as string, id: presenterLink.id as string };
  };

  it("creates a link whose URL carries the token in the fragment, and lists it without the token", async () => {
    const { linkUrl, token } = await createLink();
    expect(linkUrl).toMatch(/\/apresentacoes\/controle#t=eip_[A-Za-z0-9_-]{43}$/);
    const listed = await gql(app, LINKS, { p: deckId }, jwt);
    expect(listed.data.presenterLinks).toHaveLength(1);
    expect(JSON.stringify(listed.data)).not.toContain(token);
  });

  it("serves the private presentation in full to its link", async () => {
    const { token } = await createLink();
    const res = await gql(app, FOR_PRESENTER, undefined, token);
    expect(res.errors).toBeUndefined();
    expect(res.data.presentationForPresenter).toMatchObject({ id: deckId, visibility: "PRIVATE", slideCount: 2 });
    expect(res.data.presentationForPresenter.slides[1]).toMatchObject({ notes: "segredo", hidden: true });
  });

  it("gives a link no other power: no edits, no library, no session, no key or link management", async () => {
    const { token } = await createLink();
    const denied = [
      gql(app, `mutation ($id: ID!) { updatePresentation(id: $id, input: { title: "x" }) { id } }`, { id: deckId }, token),
      gql(app, `mutation ($id: ID!) { deletePresentation(id: $id) }`, { id: deckId }, token),
      gql(app, `query ($id: ID!) { presentation(id: $id) { id } }`, { id: deckId }, token),
      gql(app, `{ presentations { id } }`, undefined, token),
      gql(app, `{ me { id } }`, undefined, token),
      gql(app, CREATE_KEY, undefined, token),
      gql(app, CREATE_LINK, { p: deckId, name: "x", e: "ONE_DAY" }, token),
      gql(app, LINKS, { p: deckId }, token),
    ];
    for (const res of await Promise.all(denied)) expect(errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("requires a CMS session to manage links: API keys and JWT-less callers are refused", async () => {
    const key = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey.token;
    expect(errorCode(await gql(app, CREATE_LINK, { p: deckId, name: "x", e: "ONE_DAY" }, key))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, LINKS, { p: deckId }))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LINKS, { p: deckId }, plain))).toBe("FORBIDDEN");
    expect(errorCode(await gql(app, FOR_PRESENTER, undefined, jwt))).toBe("UNAUTHENTICATED");
  });

  it("stops working the moment it is revoked", async () => {
    const { token, id } = await createLink();
    await gql(app, REVOKE, { id }, jwt);
    const res = await gql(app, FOR_PRESENTER, undefined, token);
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
    expect(res.errors?.[0].message).toBe("Link revogado ou expirado");
  });

  it("is accepted on the socket, and refused there once revoked (4403)", async () => {
    const { token, id } = await createLink();
    const socket = wsClient(url, { authorization: `Bearer ${token}` });
    const res = await wsRequest(socket, FOR_PRESENTER);
    expect(res.data?.presentationForPresenter.id).toBe(deckId);
    await socket.dispose();

    await gql(app, REVOKE, { id }, jwt);
    expect(await closeCodeOf(url, { authorization: `Bearer ${token}` })).toBe(4403);
  });
});
