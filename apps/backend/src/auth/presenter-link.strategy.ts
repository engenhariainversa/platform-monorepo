import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-custom";
import { PresenterLinksService } from "../presenter-links/presenter-links.service";
import type { AuthenticatedUser } from "./auth-kind";

/**
 * Bearer tokens starting with "eip_" are presenter links. Anything else is
 * "not mine" (null), so passport tries the next strategy of the guard. A dead
 * link throws, which stops the chain with "Link revogado ou expirado".
 */
@Injectable()
export class PresenterLinkStrategy extends PassportStrategy(Strategy, "presenter-link") {
  constructor(private readonly presenterLinks: PresenterLinksService) {
    super();
  }

  async validate(req: { headers?: { authorization?: string } }): Promise<AuthenticatedUser | null> {
    const match = /^Bearer\s+(eip_\S+)$/i.exec(req.headers?.authorization ?? "");
    if (!match) return null;
    return this.presenterLinks.authenticate(match[1]);
  }
}
