import { describe, expect, it } from "vitest";
import { publicPresentationUrl } from "./landing-url";

describe("publicPresentationUrl", () => {
  it("builds the landing deck URL without a double slash", () => {
    expect(publicPresentationUrl("minha-live", "https://engenhariainversa.com.br/")).toBe(
      "https://engenhariainversa.com.br/apresentacoes/minha-live",
    );
  });
});
