import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./api-key-token";

describe("generateToken", () => {
  it("returns an ei_ token, its sha256 and an 8-char display prefix", () => {
    const { token, hash, displayPrefix } = generateToken("ei_");
    expect(token).toMatch(/^ei_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(displayPrefix).toBe(token.slice(3, 11));
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken("ei_").token));
    expect(tokens.size).toBe(50);
  });
});
