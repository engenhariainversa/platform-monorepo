import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { prisma, type ApiKey } from "@repo/database";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { generateToken, hashToken } from "./api-key-token";

const HOUR = 3600_000;

export const API_KEY_TTL_MS = {
  ONE_HOUR: HOUR,
  ONE_DAY: 24 * HOUR,
  SEVEN_DAYS: 7 * 24 * HOUR,
} as const;
export type ApiKeyExpiryKey = keyof typeof API_KEY_TTL_MS;

const LAST_USED_RESOLUTION_MS = 60_000;

@Injectable()
export class ApiKeysService {
  async create(
    userId: string,
    name: string,
    expiresIn: ApiKeyExpiryKey,
  ): Promise<{ apiKey: ApiKey; token: string }> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Nome obrigatório");
    if (trimmed.length > 80) throw new BadRequestException("Nome com no máximo 80 caracteres");

    const { token, hash, displayPrefix } = generateToken("ei_");
    const apiKey = await prisma.apiKey.create({
      data: {
        name: trimmed,
        prefix: displayPrefix,
        hash,
        createdById: userId,
        expiresAt: new Date(Date.now() + API_KEY_TTL_MS[expiresIn]),
      },
    });
    return { apiKey, token };
  }

  list(): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  }

  async revoke(id: string): Promise<ApiKey> {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException("Chave não encontrada");
    if (key.revokedAt) return key;
    return prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const key = await prisma.apiKey.findUnique({
      where: { hash: hashToken(token) },
      include: { createdBy: { include: { role: true } } },
    });
    if (!key) throw new UnauthorizedException("Chave inválida");
    if (key.revokedAt) throw new UnauthorizedException("Chave revogada");
    if (key.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException("Chave expirada");

    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }

    return { ...key.createdBy, authKind: "apiKey", apiKeyId: key.id };
  }
}
