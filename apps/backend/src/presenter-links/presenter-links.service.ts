import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { prisma, type PresenterLink } from "@repo/database";
import { generateToken, hashToken } from "../api-keys/api-key-token";
import type { AuthenticatedUser } from "../auth/auth-kind";
import { assertWritable } from "../presentations/presentations.service";

const HOUR = 3600_000;

export const PRESENTER_LINK_TTL_MS = {
  TWO_HOURS: 2 * HOUR,
  TWELVE_HOURS: 12 * HOUR,
  ONE_DAY: 24 * HOUR,
  SEVEN_DAYS: 7 * 24 * HOUR,
} as const;
export type PresenterLinkExpiryKey = keyof typeof PRESENTER_LINK_TTL_MS;

/** One message for unknown, revoked, expired and trashed: the holder needs no detail. */
export const LINK_GONE = "Link revogado ou expirado";

const LAST_USED_RESOLUTION_MS = 60_000;

/** Where the landing is served; the presenter link page lives there (spec L4). */
export function landingUrl(): string {
  return (process.env.LANDING_URL ?? "https://engenhariainversa.com.br").replace(/\/+$/, "");
}

@Injectable()
export class PresenterLinksService {
  private readonly revokeListeners = new Set<(linkId: string) => void>();

  /** Called once per link, when it is revoked (Task 7 closes its sockets). */
  onRevoked(listener: (linkId: string) => void): void {
    this.revokeListeners.add(listener);
  }

  async create(
    presentationId: string,
    userId: string,
    name: string,
    expiresIn: PresenterLinkExpiryKey,
  ): Promise<{ presenterLink: PresenterLink; token: string; url: string }> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException("Nome obrigatório");
    if (trimmed.length > 80) throw new BadRequestException("Nome com no máximo 80 caracteres");
    await assertWritable(presentationId);

    const { token, hash, displayPrefix } = generateToken("eip_");
    const presenterLink = await prisma.presenterLink.create({
      data: {
        presentationId,
        name: trimmed,
        prefix: displayPrefix,
        hash,
        createdById: userId,
        expiresAt: new Date(Date.now() + PRESENTER_LINK_TTL_MS[expiresIn]),
      },
    });
    // The token rides in the fragment: it is never sent to the landing server
    // nor written to access logs (spec L4).
    return { presenterLink, token, url: `${landingUrl()}/apresentacoes/controle#t=${token}` };
  }

  list(presentationId: string): Promise<PresenterLink[]> {
    return prisma.presenterLink.findMany({ where: { presentationId }, orderBy: { createdAt: "desc" } });
  }

  async revoke(id: string): Promise<PresenterLink> {
    const link = await prisma.presenterLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException("Link não encontrado");
    if (link.revokedAt) return link;
    const revoked = await prisma.presenterLink.update({ where: { id }, data: { revokedAt: new Date() } });
    for (const listener of this.revokeListeners) listener(id);
    return revoked;
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const link = await prisma.presenterLink.findUnique({
      where: { hash: hashToken(token) },
      include: {
        createdBy: { include: { role: true } },
        presentation: { select: { deletedAt: true } },
      },
    });
    if (!link || link.revokedAt || link.expiresAt.getTime() <= Date.now() || link.presentation.deletedAt) {
      throw new UnauthorizedException(LINK_GONE);
    }

    if (!link.lastUsedAt || Date.now() - link.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      await prisma.presenterLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    }

    return {
      ...link.createdBy,
      authKind: "presenterLink",
      presenterLinkId: link.id,
      presenterPresentationId: link.presentationId,
      presenterLinkExpiresAt: link.expiresAt,
    };
  }
}
