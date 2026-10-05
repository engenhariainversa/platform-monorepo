import { UnauthorizedException } from "@nestjs/common";
import { GraphQLError } from "graphql";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { isValidSlug } from "@repo/slides";
import { createUser, resetDatabase } from "../../test/helpers";
import { PresentationsService, type Viewer } from "./presentations.service";

const service = new PresentationsService();
const cover = { template: "cover", content: { title: "Capa" } };
const bullets = { template: "bullets", content: { title: "T", items: ["a"] }, notes: "segredo" };

const codeOf = (fn: () => Promise<unknown>) =>
  fn().then(
    () => undefined,
    (e: unknown) => (e instanceof GraphQLError ? e.extensions.code : (e as Error).constructor.name),
  );

describe("PresentationsService", () => {
  let userId: string;
  let reader: Viewer;
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    userId = user.id;
    reader = { user, canRead: true };
  });

  describe("create", () => {
    it("generates a slug, defaults to PRIVATE and stores validated, ordered slides", async () => {
      const p = await service.create({ title: "Introdução à Engenharia", slides: [cover, bullets] }, userId);
      expect(p.slug).toBe("introducao-a-engenharia");
      expect(p.visibility).toBe("PRIVATE");
      expect(p.slides.map((s) => [s.order, s.template])).toEqual([[0, "cover"], [1, "bullets"]]);
      expect(p.slides[0].content).toEqual({ title: "Capa", showMascot: true });
      expect(p.slides[1].notes).toBe("segredo");
    });

    it("suffixes generated slugs on collision", async () => {
      await service.create({ title: "Live" }, userId);
      await service.create({ title: "Live" }, userId);
      const third = await service.create({ title: "Live" }, userId);
      expect(third.slug).toBe("live-3");
    });

    it("falls back to `apresentacao` for punctuation- or emoji-only titles", async () => {
      expect((await service.create({ title: "?!… 🎉🚀" }, userId)).slug).toBe("apresentacao");
      expect((await service.create({ title: "🎉" }, userId)).slug).toBe("apresentacao-2");
    });

    it("keeps suffixed slugs of long titles within 80 characters", async () => {
      const title = "Engenharia ".repeat(11).slice(0, 120);
      const first = await service.create({ title }, userId);
      const second = await service.create({ title }, userId);
      const third = await service.create({ title }, userId);
      const copy = await service.duplicate(first.id, userId);
      for (const p of [first, second, third, copy]) {
        expect(p.slug.length).toBeLessThanOrEqual(80);
        expect(isValidSlug(p.slug)).toBe(true);
      }
      expect(second.slug).toMatch(/-2$/);
      expect(third.slug).toMatch(/-3$/);
      expect(copy.slug).toMatch(/-4$/);
    });

    it("rejects an explicit slug that is taken or malformed", async () => {
      await service.create({ title: "A", slug: "minha-live" }, userId);
      expect(await codeOf(() => service.create({ title: "B", slug: "minha-live" }, userId))).toBe("SLUG_TAKEN");
      expect(await codeOf(() => service.create({ title: "B", slug: "Minha Live" }, userId))).toBe("INVALID_SLUG");
    });

    it("writes nothing when one slide is invalid, and points at it", async () => {
      const err = await service
        .create({ title: "X", slides: [cover, { template: "code", content: { language: "ts", code: "" } }] }, userId)
        .catch((e) => e);
      expect(err).toBeInstanceOf(GraphQLError);
      expect(err.extensions).toMatchObject({
        code: "INVALID_SLIDE_CONTENT",
        slideIndex: 1,
        template: "code",
        issues: [{ path: "code", message: "Obrigatório" }],
      });
      expect(await prisma.presentation.count()).toBe(0);
    });

    it("rejects unknown templates with UNKNOWN_TEMPLATE", async () => {
      const err = await service.create({ title: "X", slides: [{ template: "hero", content: {} }] }, userId).catch((e) => e);
      expect(err.extensions).toMatchObject({ code: "UNKNOWN_TEMPLATE", slideIndex: 0, template: "hero" });
    });

    it("requires a non-empty title up to 120 characters", async () => {
      expect(await codeOf(() => service.create({ title: "  " }, userId))).toBe("BAD_USER_INPUT");
      expect(await codeOf(() => service.create({ title: "x".repeat(121) }, userId))).toBe("BAD_USER_INPUT");
    });
  });

  describe("reads and visibility", () => {
    it("serves PUBLIC decks to anonymous readers without notes or hidden slides", async () => {
      const p = await service.create(
        { title: "Pub", visibility: "PUBLIC", slides: [cover, { ...bullets, hidden: true }] },
        userId,
      );
      const anon = await service.getBySlug(p.slug, null);
      expect(anon?.slides).toHaveLength(1);
      expect(anon?.slides[0].notes).toBeNull();

      const full = await service.getBySlug(p.slug, reader);
      expect(full?.slides).toHaveLength(2);
      expect(full?.slides[1].notes).toBe("segredo");
    });

    it.each(["PRIVATE", "MEMBERS"] as const)("refuses %s decks to anonymous readers", async (visibility) => {
      const p = await service.create({ title: "Priv", visibility }, userId);
      await expect(service.getBySlug(p.slug, null)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.getBySlug(p.slug, { user: reader!.user, canRead: false })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect((await service.getBySlug(p.slug, reader))?.id).toBe(p.id);
    });

    it("returns null for an unknown slug", async () => {
      expect(await service.getBySlug("nada", null)).toBeNull();
    });

    it("treats a trashed PUBLIC deck as private and keeps its slug reserved", async () => {
      const p = await service.create({ title: "Lixo", visibility: "PUBLIC" }, userId);
      await service.softDelete(p.id);
      await expect(service.getBySlug(p.slug, null)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(await codeOf(() => service.create({ title: "Outro", slug: p.slug }, userId))).toBe("SLUG_TAKEN");
    });

    it("lists active and trashed decks separately, most recently updated first", async () => {
      const a = await service.create({ title: "A" }, userId);
      const b = await service.create({ title: "B" }, userId);
      await service.softDelete(a.id);
      expect((await service.list(false)).map((p) => p.id)).toEqual([b.id]);
      expect((await service.list(true)).map((p) => p.id)).toEqual([a.id]);
    });
  });

  describe("update, duplicate and trash", () => {
    it("updates fields and validates a new slug", async () => {
      const p = await service.create({ title: "A" }, userId);
      const u = await service.update(p.id, { title: "B", slug: "novo-slug", visibility: "PUBLIC", description: "d" });
      expect(u).toMatchObject({ title: "B", slug: "novo-slug", visibility: "PUBLIC", description: "d" });
      expect(await codeOf(() => service.update(p.id, { slug: "Bad Slug" }))).toBe("INVALID_SLUG");
    });

    it("duplicates as a PRIVATE copy with its slides", async () => {
      const p = await service.create({ title: "Base", visibility: "PUBLIC", slides: [cover, bullets] }, userId);
      const copy = await service.duplicate(p.id, userId);
      expect(copy.title).toBe("Base (cópia)");
      expect(copy.slug).toBe("base-copia");
      expect(copy.visibility).toBe("PRIVATE");
      expect(copy.slides.map((s) => s.template)).toEqual(["cover", "bullets"]);
      expect(copy.slides[1].notes).toBe("segredo");
    });

    it("blocks writes to trashed decks, restores, and purges only from the trash", async () => {
      const p = await service.create({ title: "A" }, userId);
      expect(await codeOf(() => service.purge(p.id))).toBe("BAD_USER_INPUT");
      expect(await service.softDelete(p.id)).toBe(true);
      expect(await service.softDelete(p.id)).toBe(true);
      expect(await codeOf(() => service.update(p.id, { title: "B" }))).toBe("BAD_USER_INPUT");
      expect(await codeOf(() => service.duplicate(p.id, userId))).toBe("BAD_USER_INPUT");
      expect((await service.restore(p.id)).deletedAt).toBeNull();
      await service.softDelete(p.id);
      expect(await service.purge(p.id)).toBe(true);
      expect(await prisma.presentation.count()).toBe(0);
    });

    it("reports NOT_FOUND for unknown ids", async () => {
      expect(await codeOf(() => service.update("00000000-0000-0000-0000-000000000000", { title: "x" }))).toBe(
        "NOT_FOUND",
      );
    });
  });
});
