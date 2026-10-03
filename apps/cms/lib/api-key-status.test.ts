import { describe, expect, it } from "vitest";
import { apiKeyStatus } from "./api-key-status";

const NOW = Date.parse("2026-10-01T12:00:00Z");

describe("apiKeyStatus", () => {
  it("is active before expiry", () => {
    expect(apiKeyStatus({ expiresAt: "2026-10-01T13:00:00Z", revokedAt: null }, NOW)).toBe("active");
  });
  it("is expired at or after expiry", () => {
    expect(apiKeyStatus({ expiresAt: "2026-10-01T12:00:00Z", revokedAt: null }, NOW)).toBe("expired");
  });
  it("revoked wins over expired", () => {
    expect(apiKeyStatus({ expiresAt: "2026-09-01T00:00:00Z", revokedAt: "2026-08-31T00:00:00Z" }, NOW)).toBe("revoked");
  });
});
