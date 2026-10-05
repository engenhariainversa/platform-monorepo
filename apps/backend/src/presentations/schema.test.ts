import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";

describe("presentation tables", () => {
  beforeEach(resetDatabase);

  it("stores a deck with ordered JSON slides, PRIVATE by default", async () => {
    const user = await createUser();
    const deck = await prisma.presentation.create({
      data: {
        slug: "minha-live",
        title: "Minha live",
        createdById: user.id,
        slides: {
          create: [
            { order: 0, template: "cover", content: { title: "Oi", showMascot: true } },
            { order: 1, template: "bullets", content: { title: "T", items: ["a"] }, notes: "fale devagar" },
          ],
        },
      },
      include: { slides: { orderBy: { order: "asc" } } },
    });
    expect(deck.visibility).toBe("PRIVATE");
    expect(deck.deletedAt).toBeNull();
    expect(deck.slides.map((s) => s.template)).toEqual(["cover", "bullets"]);
    expect(deck.slides[0].notes).toBe("");
    expect(deck.slides[0].hidden).toBe(false);
    expect(deck.slides[1].content).toEqual({ title: "T", items: ["a"] });
  });

  it("deletes slides with their presentation", async () => {
    const user = await createUser();
    const deck = await prisma.presentation.create({
      data: { slug: "x", title: "X", createdById: user.id, slides: { create: [{ template: "cover", content: {} }] } },
    });
    await prisma.presentation.delete({ where: { id: deck.id } });
    expect(await prisma.slide.count()).toBe(0);
  });

  it("enforces unique slugs and unique API key hashes", async () => {
    const user = await createUser();
    await prisma.presentation.create({ data: { slug: "dup", title: "A", createdById: user.id } });
    await expect(
      prisma.presentation.create({ data: { slug: "dup", title: "B", createdById: user.id } }),
    ).rejects.toMatchObject({ code: "P2002" });

    const key = { name: "k", prefix: "abcd1234", hash: "h", createdById: user.id, expiresAt: new Date() };
    await prisma.apiKey.create({ data: key });
    await expect(prisma.apiKey.create({ data: key })).rejects.toMatchObject({ code: "P2002" });
  });
});
