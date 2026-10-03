import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { authKindOf } from "./auth-kind";
import { GqlOptionalAuthGuard } from "./jwt-or-api-key.guard";

describe("GqlOptionalAuthGuard.handleRequest", () => {
  const guard = new GqlOptionalAuthGuard();

  it("lets anonymous requests through as null", () => {
    expect(guard.handleRequest(null, false)).toBeNull();
  });

  it("rejects an expired key even when the route is optional", () => {
    const err = new UnauthorizedException("Chave expirada");
    expect(() => guard.handleRequest(err, false)).toThrow("Chave expirada");
  });

  it("passes the user through", () => {
    const user = { id: "u" } as any;
    expect(guard.handleRequest(null, user)).toBe(user);
  });
});

describe("authKindOf", () => {
  it("distinguishes keys from JWT sessions", () => {
    expect(authKindOf({ authKind: "apiKey" } as any)).toBe("apiKey");
    expect(authKindOf({ id: "u" } as any)).toBe("jwt");
    expect(authKindOf(null)).toBeNull();
  });
});
