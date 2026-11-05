import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";
import { hashToken } from "../api-keys/api-key-token";
import { PresentationsService } from "../presentations/presentations.service";
import { LINK_GONE, PresenterLinksService, landingUrl } from "./presenter-links.service";

const presentations = new PresentationsService();
const service = new PresenterLinksService();

describe("PresenterLinksService", () => {
  let userId: string;
  let deckId: string;
  beforeEach(async () => {
    await resetDatabase();
    userId = (await createUser()).id;
    deckId = (await presentations.create({ title: "Deck" }, userId)).id;
  });
  afterEach(() => {
    delete process.env.LANDING_URL;
  });

  it("creates an eip_ token, stores only its hash and returns the landing URL once", async () => {
    process.env.LANDING_URL = "http://localhost:4052/";
    const { presenterLink, token, url } = await service.create(deckId, userId, "  Notebook do evento ", "TWO_HOURS");
    expect(token).toMatch(/^eip_[A-Za-z0-9_-]{43}$/);
    expect(url).toBe(`http://localhost:4052/apresentacoes/controle#t=${token}`);
    expect(presenterLink.name).toBe("Notebook do evento");
    expect(presenterLink.prefix).toBe(token.slice(4, 12));
    const row = await prisma.presenterLink.findUniqueOrThrow({ where: { id: presenterLink.id } });
    expect(row.hash).toBe(hashToken(token));
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(Math.abs(ttl - 2 * 3600_000)).toBeLessThan(5_000);
  });

  it("falls back to the production landing URL", () => {
    delete process.env.LANDING_URL;
    expect(landingUrl()).toBe("https://engenhariainversa.com.br");
  });

  it("rejects an empty name and a trashed presentation", async () => {
    await expect(service.create(deckId, userId, "  ", "ONE_DAY")).rejects.toThrow("Nome obrigatório");
    await presentations.softDelete(deckId);
    await expect(service.create(deckId, userId, "x", "ONE_DAY")).rejects.toThrow("Apresentação na lixeira");
  });

  it("authenticates as the creator, scoped to the presentation", async () => {
    const { presenterLink, token } = await service.create(deckId, userId, "k", "ONE_DAY");
    const user = await service.authenticate(token);
    expect(user.id).toBe(userId);
    expect(user.authKind).toBe("presenterLink");
    expect(user.presenterLinkId).toBe(presenterLink.id);
    expect(user.presenterPresentationId).toBe(deckId);
    expect(user.presenterLinkExpiresAt?.getTime()).toBe(presenterLink.expiresAt.getTime());
  });

  it("rejects unknown, expired, revoked and trashed-presentation links with one message", async () => {
    await expect(service.authenticate("eip_nope")).rejects.toThrow(LINK_GONE);

    const expired = await service.create(deckId, userId, "old", "TWO_HOURS");
    await prisma.presenterLink.update({
      where: { id: expired.presenterLink.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.authenticate(expired.token)).rejects.toThrow(LINK_GONE);

    const revoked = await service.create(deckId, userId, "rev", "TWO_HOURS");
    await service.revoke(revoked.presenterLink.id);
    await expect(service.authenticate(revoked.token)).rejects.toThrow(LINK_GONE);

    const live = await service.create(deckId, userId, "ok", "TWO_HOURS");
    await presentations.softDelete(deckId);
    await expect(service.authenticate(live.token)).rejects.toThrow(LINK_GONE);
  });

  it("lists newest first, revokes idempotently and notifies listeners once", async () => {
    const a = await service.create(deckId, userId, "a", "ONE_DAY");
    const b = await service.create(deckId, userId, "b", "ONE_DAY");
    expect((await service.list(deckId)).map((l) => l.id)).toEqual([b.presenterLink.id, a.presenterLink.id]);

    const revokedIds: string[] = [];
    service.onRevoked((id) => revokedIds.push(id));
    const once = await service.revoke(a.presenterLink.id);
    const twice = await service.revoke(a.presenterLink.id);
    expect(twice.revokedAt?.getTime()).toBe(once.revokedAt?.getTime());
    expect(revokedIds).toEqual([a.presenterLink.id]);
  });
});
