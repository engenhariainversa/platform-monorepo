import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { prisma } from "@repo/database";
import { createUser, resetDatabase } from "../../test/helpers";
import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService", () => {
  const service = new ApiKeysService();
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());

  it("creates a key, stores only the hash, and returns the token once", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "  Live #12 — Claude  ", "ONE_DAY");
    expect(apiKey.name).toBe("Live #12 — Claude");
    expect(token.startsWith("ei_")).toBe(true);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.hash).not.toContain(token);
    expect(row.prefix).toBe(token.slice(3, 11));
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(ttl).toBeGreaterThan(24 * 3600_000 - 5_000);
    expect(ttl).toBeLessThan(24 * 3600_000 + 5_000);
  });

  it("rejects an empty name", async () => {
    const user = await createUser();
    await expect(service.create(user.id, "   ", "ONE_HOUR")).rejects.toThrow("Nome obrigatório");
  });

  it("authenticates a valid key as its creator, marked apiKey", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "k", "ONE_HOUR");
    const authed = await service.authenticate(token);
    expect(authed.id).toBe(user.id);
    expect(authed.role.name).toBe("ADMIN");
    expect(authed.authKind).toBe("apiKey");
    expect(authed.apiKeyId).toBe(apiKey.id);
  });

  it("rejects unknown, expired and revoked keys with distinct messages", async () => {
    const user = await createUser();
    await expect(service.authenticate("ei_nope")).rejects.toThrow(new UnauthorizedException("Chave inválida"));

    const expired = await service.create(user.id, "old", "ONE_HOUR");
    await prisma.apiKey.update({ where: { id: expired.apiKey.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(service.authenticate(expired.token)).rejects.toThrow("Chave expirada");

    const revoked = await service.create(user.id, "rev", "ONE_HOUR");
    await service.revoke(revoked.apiKey.id);
    await expect(service.authenticate(revoked.token)).rejects.toThrow("Chave revogada");
  });

  it("writes lastUsedAt at most once a minute", async () => {
    const user = await createUser();
    const { apiKey, token } = await service.create(user.id, "k", "ONE_HOUR");
    await service.authenticate(token);
    const first = (await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).lastUsedAt;
    expect(first).not.toBeNull();
    await service.authenticate(token);
    const second = (await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })).lastUsedAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });

  it("lists newest first and revokes idempotently", async () => {
    const user = await createUser();
    const a = await service.create(user.id, "a", "ONE_HOUR");
    const b = await service.create(user.id, "b", "ONE_HOUR");
    expect((await service.list()).map((k) => k.id)).toEqual([b.apiKey.id, a.apiKey.id]);
    const once = await service.revoke(a.apiKey.id);
    const twice = await service.revoke(a.apiKey.id);
    expect(twice.revokedAt?.getTime()).toBe(once.revokedAt?.getTime());
  });
});
