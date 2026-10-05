import { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createTestApp, createUser, errorCode, gql, jwtFor, resetDatabase } from "../../test/helpers";

const FIELDS = `id slug title description visibility slideCount deletedAt updatedAt
  slides { id order template content notes hidden }`;
const CREATE = `mutation ($input: CreatePresentationInput!) { createPresentation(input: $input) { ${FIELDS} } }`;
const BY_SLUG = `query ($slug: String!) { presentationBySlug(slug: $slug) { ${FIELDS} } }`;
const LIST = `query ($trash: Boolean) { presentations(trash: $trash) { id title } }`;
const UPDATE = `mutation ($id: ID!, $input: UpdatePresentationInput!) { updatePresentation(id: $id, input: $input) { id visibility } }`;
const DELETE = `mutation ($id: ID!) { deletePresentation(id: $id) }`;
const PURGE = `mutation ($id: ID!) { purgePresentation(id: $id) }`;
const CREATE_KEY = `mutation { createApiKey(name: "claude", expiresIn: ONE_HOUR) { token apiKey { id } } }`;

const deckInput = {
  title: "Live #12",
  slides: [
    { template: "cover", content: { title: "Live #12" } },
    { template: "bullets", content: { title: "T", items: ["a"] }, notes: "lembrar do proxy", hidden: true },
  ],
};

describe("presentations over GraphQL", () => {
  let app: INestApplication;
  let jwt: string;
  let key: string;
  let keyId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase();
    jwt = jwtFor(app, await createUser({ admin: true }));
    const k = (await gql(app, CREATE_KEY, undefined, jwt)).data.createApiKey;
    key = k.token;
    keyId = k.apiKey.id;
  });

  it("lets an API key create a full deck in one call", async () => {
    const res = await gql(app, CREATE, { input: deckInput }, key);
    expect(res.errors).toBeUndefined();
    const deck = res.data.createPresentation;
    expect(deck).toMatchObject({ slug: "live-12", visibility: "PRIVATE", slideCount: 2 });
    expect(deck.slides[0].content).toEqual({ title: "Live #12", showMascot: true });
  });

  it("returns INVALID_SLIDE_CONTENT with index, template and issues", async () => {
    const res = await gql(
      app,
      CREATE,
      { input: { title: "X", slides: [{ template: "stats", content: { items: [] } }] } },
      key,
    );
    expect(res.errors?.[0].extensions).toMatchObject({
      code: "INVALID_SLIDE_CONTENT",
      slideIndex: 0,
      template: "stats",
      issues: [{ path: "items", message: "Mínimo de 2 itens" }],
    });
  });

  it("lets an API key publish and trash, but not purge", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, key)).data.createPresentation;
    expect((await gql(app, UPDATE, { id: deck.id, input: { visibility: "PUBLIC" } }, key)).data.updatePresentation.visibility).toBe("PUBLIC");
    expect((await gql(app, DELETE, { id: deck.id }, key)).data.deletePresentation).toBe(true);
    expect(errorCode(await gql(app, PURGE, { id: deck.id }, key))).toBe("UNAUTHENTICATED");
    expect((await gql(app, PURGE, { id: deck.id }, jwt)).data.purgePresentation).toBe(true);
  });

  it("hides private decks from anonymous slug reads and strips notes/hidden on public ones", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, jwt)).data.createPresentation;
    expect(errorCode(await gql(app, BY_SLUG, { slug: deck.slug }))).toBe("UNAUTHENTICATED");

    await gql(app, UPDATE, { id: deck.id, input: { visibility: "PUBLIC" } }, jwt);
    const anon = (await gql(app, BY_SLUG, { slug: deck.slug })).data.presentationBySlug;
    expect(anon.slides).toHaveLength(1);
    expect(anon.slides[0].notes).toBeNull();
    expect(anon.slideCount).toBe(1);

    const authed = (await gql(app, BY_SLUG, { slug: deck.slug }, key)).data.presentationBySlug;
    expect(authed.slides).toHaveLength(2);
    expect(authed.slides[1].notes).toBe("lembrar do proxy");
  });

  it("returns null for an unknown slug", async () => {
    expect((await gql(app, BY_SLUG, { slug: "nao-existe" })).data.presentationBySlug).toBeNull();
  });

  it("rejects an expired key even on the optional slug query", async () => {
    await prisma.apiKey.update({ where: { id: keyId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await gql(app, BY_SLUG, { slug: "qualquer" }, key);
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
    expect(res.errors?.[0].message).toBe("Chave expirada");
  });

  it("requires credentials for the library and enforces role permissions", async () => {
    expect(errorCode(await gql(app, LIST, {}))).toBe("UNAUTHENTICATED");
    const plain = jwtFor(app, await createUser({ roleName: "AUTHENTICATED" }));
    expect(errorCode(await gql(app, LIST, {}, plain))).toBe("FORBIDDEN");
    expect((await gql(app, LIST, { trash: false }, jwt)).data.presentations).toEqual([]);
  });

  it("serves the template catalogue publicly with JSON Schemas and examples", async () => {
    const res = await gql(app, `{ slideTemplates { key label description jsonSchema example } }`);
    expect(res.data.slideTemplates.map((t: { key: string }) => t.key)).toEqual([
      "cover", "agenda", "section", "bullets", "split", "code",
      "closing", "quote", "comparison", "stats", "image",
    ]);
    expect(res.data.slideTemplates[0].jsonSchema.type).toBe("object");
  });

  it("runs the slide operations end to end", async () => {
    const deck = (await gql(app, CREATE, { input: deckInput }, key)).data.createPresentation;
    const created = await gql(
      app,
      `mutation ($p: ID!, $i: SlideInput!) { createSlide(presentationId: $p, input: $i, position: 0) { id order } }`,
      { p: deck.id, i: { template: "section", content: { title: "Abertura" } } },
      key,
    );
    expect(created.data.createSlide.order).toBe(0);

    const upd = await gql(
      app,
      `mutation ($id: ID!, $i: UpdateSlideInput!) { updateSlide(id: $id, input: $i) { template content } }`,
      { id: created.data.createSlide.id, i: { template: "quote" } },
      key,
    );
    expect(upd.data.updateSlide.template).toBe("quote");

    const replaced = await gql(
      app,
      `mutation ($p: ID!, $s: [SlideInput!]!) { replaceSlides(presentationId: $p, slides: $s) { slideCount } }`,
      { p: deck.id, s: [{ template: "cover", content: { title: "Só capa" } }] },
      key,
    );
    expect(replaced.data.replaceSlides.slideCount).toBe(1);
  });
});
