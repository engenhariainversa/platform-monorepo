import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { listen, openSocket, sleep } from "../../test/ws";

const CREATE_DECK = `mutation { createPresentation(input: { title: "Live", visibility: PUBLIC }) { id } }`;
const CREATE_LINK = `mutation ($p: ID!) {
  createPresenterLink(presentationId: $p, name: "Evento", expiresIn: TWO_HOURS) { url presenterLink { id } }
}`;
const REVOKE = `mutation ($id: ID!) { revokePresenterLink(id: $id) { id } }`;
const MAKE_PRIVATE = `mutation ($id: ID!) { updatePresentation(id: $id, input: { visibility: PRIVATE }) { id } }`;
const TRASH = `mutation ($id: ID!) { deletePresentation(id: $id) }`;

describe("presenter link sockets", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;

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
  });

  it("disconnects every socket of a link the moment it is revoked, and no other", async () => {
    const deckId = (await gql(app, CREATE_DECK, undefined, jwt)).data.createPresentation.id;
    const created = (await gql(app, CREATE_LINK, { p: deckId }, jwt)).data.createPresenterLink;
    const other = (await gql(app, CREATE_LINK, { p: deckId }, jwt)).data.createPresenterLink;
    const tokenOf = (c: { url: string }) => c.url.split("#t=")[1];

    const first = await openSocket(url, { authorization: `Bearer ${tokenOf(created)}` });
    const second = await openSocket(url, { authorization: `Bearer ${tokenOf(created)}` });
    const untouched = await openSocket(url, { authorization: `Bearer ${tokenOf(other)}` });
    let untouchedClosed = false;
    void untouched.closed.then(() => (untouchedClosed = true));

    await gql(app, REVOKE, { id: created.presenterLink.id }, jwt);

    expect(await first.closed).toBe(4403);
    expect(await second.closed).toBe(4403);
    await sleep(200);
    expect(untouchedClosed).toBe(false);
    await untouched.client.dispose();
  });

  it("disconnects the deck's presenter link sockets when the deck is trashed, not when it turns private", async () => {
    const deckId = (await gql(app, CREATE_DECK, undefined, jwt)).data.createPresentation.id;
    const otherDeckId = (await gql(app, CREATE_DECK, undefined, jwt)).data.createPresentation.id;
    const link = (await gql(app, CREATE_LINK, { p: deckId }, jwt)).data.createPresenterLink;
    const otherLink = (await gql(app, CREATE_LINK, { p: otherDeckId }, jwt)).data.createPresenterLink;
    const tokenOf = (c: { url: string }) => c.url.split("#t=")[1];

    const presenter = await openSocket(url, { authorization: `Bearer ${tokenOf(link)}` });
    const otherPresenter = await openSocket(url, { authorization: `Bearer ${tokenOf(otherLink)}` });
    const admin = await openSocket(url, { authorization: `Bearer ${jwt}` });
    const closed = { presenter: false, otherPresenter: false, admin: false };
    void presenter.closed.then(() => (closed.presenter = true));
    void otherPresenter.closed.then(() => (closed.otherPresenter = true));
    void admin.closed.then(() => (closed.admin = true));

    // A private deck keeps its presenter links valid (they do not check visibility).
    await gql(app, MAKE_PRIVATE, { id: deckId }, jwt);
    await sleep(200);
    expect(closed.presenter).toBe(false);

    await gql(app, TRASH, { id: deckId }, jwt);
    expect(await presenter.closed).toBe(4403);
    await sleep(200);
    expect(closed).toEqual({ presenter: true, otherPresenter: false, admin: false });
    await otherPresenter.client.dispose();
    await admin.client.dispose();
  });
});
