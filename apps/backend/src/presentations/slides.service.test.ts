import { GraphQLError } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { SLIDE_TEMPLATES } from "@repo/slides";
import { createUser, resetDatabase } from "../../test/helpers";
import { PresentationsService } from "./presentations.service";
import { SlidesService } from "./slides.service";

const presentations = new PresentationsService();
const slides = new SlidesService();
const bullets = (title: string) => ({ template: "bullets", content: { title, items: ["a"] } });

const orderedTitles = async (presentationId: string) =>
  (await prisma.slide.findMany({ where: { presentationId }, orderBy: { order: "asc" } })).map(
    (s) => (s.content as { title: string }).title,
  );

describe("SlidesService", () => {
  let deckId: string;
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    deckId = (await presentations.create({ title: "Deck", slides: [bullets("A"), bullets("B")] }, user.id)).id;
  });

  it("appends by default and inserts at a position, keeping orders contiguous", async () => {
    await slides.createSlide(deckId, bullets("C"));
    await slides.createSlide(deckId, bullets("X"), 1);
    expect(await orderedTitles(deckId)).toEqual(["A", "X", "B", "C"]);
    const orders = (await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } })).map(
      (s) => s.order,
    );
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("parallel appends get distinct orders", async () => {
    await Promise.all(["C", "D", "E", "F", "G"].map((t) => slides.createSlide(deckId, bullets(t))));
    const orders = (await prisma.slide.findMany({ where: { presentationId: deckId } })).map((s) => s.order).sort();
    expect(new Set(orders).size).toBe(7);
    expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("reports the slide's position in INVALID_SLIDE_CONTENT on update", async () => {
    const second = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 1 } })).id;
    const err = await slides.updateSlide(second, { content: { title: "", items: ["a"] } }).catch((e) => e);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.extensions).toMatchObject({ code: "INVALID_SLIDE_CONTENT", slideIndex: 1, template: "bullets" });
  });

  it("switching only the template keeps compatible fields and stays valid", async () => {
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    const updated = await slides.updateSlide(first, { template: "code" });
    expect(updated.template).toBe("code");
    expect(updated.content).toMatchObject({ title: "A", code: SLIDE_TEMPLATES.code.defaults.code });
  });

  it("updates notes and hidden without touching content", async () => {
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    const updated = await slides.updateSlide(first, { notes: "respira", hidden: true });
    expect(updated).toMatchObject({ notes: "respira", hidden: true, content: { title: "A", items: ["a"] } });
  });

  it("replaces the whole deck atomically", async () => {
    await slides.replaceSlides(deckId, [bullets("Z")]);
    expect(await orderedTitles(deckId)).toEqual(["Z"]);
    await expect(slides.replaceSlides(deckId, [bullets("ok"), { template: "bullets", content: {} }])).rejects.toBeInstanceOf(
      GraphQLError,
    );
    expect(await orderedTitles(deckId)).toEqual(["Z"]);
  });

  it("deletes and renumbers", async () => {
    await slides.createSlide(deckId, bullets("C"));
    const first = (await prisma.slide.findFirstOrThrow({ where: { presentationId: deckId, order: 0 } })).id;
    expect(await slides.deleteSlide(first)).toBe(true);
    const rows = await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } });
    expect(rows.map((s) => s.order)).toEqual([0, 1]);
  });

  it("reorders only with exactly the deck's slide ids", async () => {
    const ids = (await prisma.slide.findMany({ where: { presentationId: deckId }, orderBy: { order: "asc" } })).map((s) => s.id);
    const result = await slides.reorderSlides(deckId, [ids[1], ids[0]]);
    expect(result.map((s) => s.id)).toEqual([ids[1], ids[0]]);
    const err = await slides.reorderSlides(deckId, [ids[0]]).catch((e) => e);
    expect(err.extensions.code).toBe("BAD_USER_INPUT");
    const dup = await slides.reorderSlides(deckId, [ids[0], ids[0]]).catch((e) => e);
    expect(dup.extensions.code).toBe("BAD_USER_INPUT");
  });

  it("bumps the presentation's updatedAt on every slide write", async () => {
    const before = (await prisma.presentation.findUniqueOrThrow({ where: { id: deckId } })).updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await slides.createSlide(deckId, bullets("C"));
    const after = (await prisma.presentation.findUniqueOrThrow({ where: { id: deckId } })).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("refuses writes to a trashed deck", async () => {
    await presentations.softDelete(deckId);
    const err = await slides.createSlide(deckId, bullets("C")).catch((e) => e);
    expect(err.message).toBe("Apresentação na lixeira");
  });
});
