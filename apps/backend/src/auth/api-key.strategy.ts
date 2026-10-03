import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-custom";
import { ApiKeysService } from "../api-keys/api-keys.service";
import type { AuthenticatedUser } from "./auth-kind";

/**
 * Bearer tokens starting with "ei_" are API keys. Anything else is left to the
 * JWT strategy (returning null = "not mine", so passport tries the next one).
 * A bad key throws, which stops the chain with that message.
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private readonly apiKeys: ApiKeysService) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser | null> {
    const header = req.headers?.authorization ?? "";
    const match = /^Bearer\s+(ei_\S+)$/i.exec(header);
    if (!match) return null;
    return this.apiKeys.authenticate(match[1]);
  }
}
