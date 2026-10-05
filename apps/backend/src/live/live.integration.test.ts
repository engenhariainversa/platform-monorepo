import { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";
import { listen, sleep, subscribeTo, wsClient, wsRequest } from "../../test/ws";
import { LiveSessionService } from "./live-session.service";

const CREATE_DECK = `mutation ($input: CreatePresentationInput!) {
  createPresentation(input: $input) { id slug slides { id } }
}`;
const UPDATE_DECK = `mutation ($id: ID!, $input: UpdatePresentationInput!) { updatePresentation(id: $id, input: $input) { id } }`;
const DELETE_DECK = `mutation ($id: ID!) { deletePresentation(id: $id) }`;
const CREATE_LINK = `mutation ($p: ID!) { createPresenterLink(presentationId: $p, name: "x", expiresIn: TWO_HOURS) { url } }`;
const STATE = `query ($slug: String!) { liveState(slug: $slug) { isLive slideId viewerCount peakViewers showViewerCount } }`;
const EVENTS = `subscription ($slug: String!) { liveEvents(slug: $slug) { type slideId viewerCount peakViewers } }`;
const START = `mutation ($p: ID!, $s: ID!) { startLive(presentationId: $p, slideId: $s) { isLive slideId peakViewers } }`;
const STOP = `mutation ($p: ID!) { stopLive(presentationId: $p) }`;
const SLIDE = `mutation ($p: ID!, $s: ID!) { setLiveSlide(presentationId: $p, slideId: $s) }`;

const slides = [
  { template: "cover", content: { title: "Capa" } },
  { template: "bullets", content: { title: "T", items: ["a"] } },
];

describe("live sessions", () => {
  let app: INestApplication;
  let url: string;
  let jwt: string;
  let deck: { id: string; slug: string; slides: { id: string }[] };
  const disposables: { dispose(): void | Promise<void> }[] = [];

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
    deck = (await gql(app, CREATE_DECK, { input: { title: "Live", visibility: "PUBLIC", slides } }, jwt)).data
      .createPresentation;
  });
  afterEach(async () => {
    // Sessions are in memory and outlive resetDatabase.
    app.get(LiveSessionService).stop(deck.id);
    await Promise.all(disposables.splice(0).map((c) => c.dispose()));
  });

  const socket = (params?: Record<string, unknown>) => {
    const c = wsClient(url, params);
    disposables.push(c);
    return c;
  };
  const eventTypes = (events: { liveEvents: { type: string } }[]) => events.map((e) => e.liveEvents.type);
  const has = (type: string) => (events: { liveEvents: { type: string } }[]) => eventTypes(events).includes(type);

  it("lets an anonymous viewer follow a session started over a presenter's socket", async () => {
    const viewer = subscribeTo(socket(), EVENTS, { slug: deck.slug });
    await sleep(200);
    const presenter = socket({ authorization: `Bearer ${jwt}` });

    const started = await wsRequest(presenter, START, { p: deck.id, s: deck.slides[0].id });
    expect(started.data?.startLive).toMatchObject({ isLive: true, slideId: deck.slides[0].id });
    await wsRequest(presenter, SLIDE, { p: deck.id, s: deck.slides[1].id });
    await wsRequest(presenter, STOP, { p: deck.id });

    // VIEWERS events (Task 5) interleave with these; wait for the last one instead of counting.
    const events = await viewer.waitUntil(has("ENDED"));
    const relevant = events.filter((e) => e.liveEvents.type !== "VIEWERS");
    expect(eventTypes(relevant)).toEqual(["STARTED", "SLIDE", "ENDED"]);
    expect(relevant[0].liveEvents.slideId).toBe(deck.slides[0].id);
    expect(relevant[1].liveEvents.slideId).toBe(deck.slides[1].id);
  });

  it("answers liveState publicly, before and during a session", async () => {
    expect((await gql(app, STATE, { slug: deck.slug })).data.liveState).toMatchObject({ isLive: false, slideId: null });
    await gql(app, START, { p: deck.id, s: deck.slides[1].id }, jwt);
    const anon = (await gql(app, STATE, { slug: deck.slug })).data.liveState;
    expect(anon).toMatchObject({ isLive: true, slideId: deck.slides[1].id, peakViewers: null });
    expect((await gql(app, STATE, { slug: deck.slug }, jwt)).data.liveState.peakViewers).toBe(0);
    expect((await gql(app, STATE, { slug: "nao-existe" })).data.liveState.isLive).toBe(false);
  });

  it("only lets presenters control a session", async () => {
    const vars = { p: deck.id, s: deck.slides[0].id };
    expect(errorCode(await gql(app, START, vars))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, START, vars, plain))).toBe("FORBIDDEN");
    const key = (await gql(app, `mutation { createApiKey(name: "k", expiresIn: ONE_HOUR) { token } }`, undefined, jwt))
      .data.createApiKey.token;
    expect(errorCode(await gql(app, START, vars, key))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, STOP, { p: deck.id }))).toBe("UNAUTHENTICATED");
  });

  it("lets a presenter link control its own presentation and no other", async () => {
    const other = (await gql(app, CREATE_DECK, { input: { title: "Outra", visibility: "PUBLIC", slides } }, jwt)).data
      .createPresentation;
    const token = (await gql(app, CREATE_LINK, { p: deck.id }, jwt)).data.createPresenterLink.url.split("#t=")[1];

    const mine = await gql(app, START, { p: deck.id, s: deck.slides[0].id }, token);
    expect(mine.data.startLive.isLive).toBe(true);
    expect(errorCode(await gql(app, START, { p: other.id, s: other.slides[0].id }, token))).toBe("UNAUTHENTICATED");
    expect(errorCode(await gql(app, STOP, { p: other.id }, token))).toBe("UNAUTHENTICATED");
  });

  it("refuses to go live on a non-public presentation or with a foreign slide", async () => {
    const priv = (await gql(app, CREATE_DECK, { input: { title: "Privada", slides } }, jwt)).data.createPresentation;
    const res = await gql(app, START, { p: priv.id, s: priv.slides[0].id }, jwt);
    expect(res.errors?.[0].message).toBe("Torne a apresentação pública para transmitir");
    const foreign = await gql(app, START, { p: deck.id, s: priv.slides[0].id }, jwt);
    expect(errorCode(foreign)).toBe("BAD_USER_INPUT");
    expect(app.get(LiveSessionService).get(deck.id)).toBeUndefined();
  });

  it("refuses to follow a slide from another presentation", async () => {
    const other = (await gql(app, CREATE_DECK, { input: { title: "Outra", visibility: "PUBLIC", slides } }, jwt)).data
      .createPresentation;
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    expect(errorCode(await gql(app, SLIDE, { p: deck.id, s: other.slides[1].id }, jwt))).toBe("BAD_USER_INPUT");
    expect(errorCode(await gql(app, SLIDE, { p: deck.id, s: "x".repeat(500) }, jwt))).toBe("BAD_USER_INPUT");
    expect(app.get(LiveSessionService).get(deck.id)?.slideId).toBe(deck.slides[0].id);
    expect((await gql(app, SLIDE, { p: deck.id, s: deck.slides[1].id }, jwt)).data.setLiveSlide).toBe(true);
    expect(app.get(LiveSessionService).get(deck.id)?.slideId).toBe(deck.slides[1].id);
  });

  it("ends the session when the presentation turns private or is trashed", async () => {
    const viewer = subscribeTo(socket(), EVENTS, { slug: deck.slug });
    await sleep(200);
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    await gql(app, UPDATE_DECK, { id: deck.id, input: { visibility: "PRIVATE" } }, jwt);
    await viewer.waitUntil(has("ENDED"));
    expect(eventTypes(viewer.events).filter((t) => t !== "VIEWERS")).toEqual(["STARTED", "ENDED"]);
    expect((await gql(app, STATE, { slug: deck.slug })).data.liveState.isLive).toBe(false);

    await gql(app, UPDATE_DECK, { id: deck.id, input: { visibility: "PUBLIC" } }, jwt);
    await gql(app, START, { p: deck.id, s: deck.slides[0].id }, jwt);
    await gql(app, DELETE_DECK, { id: deck.id }, jwt);
    expect(app.get(LiveSessionService).get(deck.id)).toBeUndefined();
  });

  it("refuses liveEvents on a private presentation", async () => {
    const priv = (await gql(app, CREATE_DECK, { input: { title: "Privada", slides } }, jwt)).data.createPresentation;
    const sub = subscribeTo(socket(), EVENTS, { slug: priv.slug });
    await sleep(300);
    expect(sub.events).toEqual([]);
    expect(JSON.stringify(sub.errors)).toContain("Apresentação privada");
  });
});
