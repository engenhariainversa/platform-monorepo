import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, SLUG_PATTERN } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Engenharia Reversa de Apps")).toBe("engenharia-reversa-de-apps");
  });

  it("strips accents", () => {
    expect(slugify("Introdução à Engenharia")).toBe("introducao-a-engenharia");
  });

  it("collapses punctuation and trims dashes", () => {
    expect(slugify("  Live #12 — Proxy & SSL!  ")).toBe("live-12-proxy-ssl");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("🚀!!!")).toBe("apresentacao");
    expect(slugify("")).toBe("apresentacao");
  });

  it("caps the length at 80 without a trailing dash", () => {
    const slug = slugify("a".repeat(79) + " bcd");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(SLUG_PATTERN);
  });
});

describe("isValidSlug", () => {
  it("accepts kebab-case", () => {
    expect(isValidSlug("live-12")).toBe(true);
  });

  it.each(["Live-12", "live--12", "-live", "live-", "live_12", "", "a".repeat(81)])(
    "rejects %s",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});
