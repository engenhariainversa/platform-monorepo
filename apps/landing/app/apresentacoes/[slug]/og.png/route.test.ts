import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Presentation } from "@repo/types";

const fetchPresentationBySlug = vi.fn<(slug: string) => Promise<Presentation | null>>();
const renderOgPng = vi.fn(async () => new Uint8Array([137, 80, 78, 71]).buffer);

vi.mock("../../../../lib/fetch-presentation", () => ({ fetchPresentationBySlug }));
vi.mock("../../../../lib/og-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/og-image")>()),
  renderOgPng,
}));

const { GET } = await import("./route");

const UPDATED_AT = "2026-10-02T12:00:00.000Z";
const VERSION = Date.parse(UPDATED_AT);

const deck = {
  id: "p1",
  slug: "minha-live",
  title: "Minha live",
  description: null,
  visibility: "PUBLIC",
  slideCount: 0,
  slides: [],
  deletedAt: null,
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
} as Presentation;

const get = (query = "") =>
  GET(new Request(`http://localhost/apresentacoes/minha-live/og.png${query}`), { params: { slug: "minha-live" } });

describe("GET /apresentacoes/<slug>/og.png", () => {
  beforeEach(() => {
    fetchPresentationBySlug.mockReset();
    renderOgPng.mockClear();
  });

  it("serves the current version with a five-minute edge cache", async () => {
    fetchPresentationBySlug.mockResolvedValue(deck);
    const res = await get(`?v=${VERSION}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=300");
    expect(renderOgPng).toHaveBeenCalledOnce();
  });

  it.each([["an old version", `?v=${VERSION - 1}`], ["no version", ""], ["garbage", "?v=abc"]])(
    "is an uncached 404 for %s",
    async (_label, query) => {
      fetchPresentationBySlug.mockResolvedValue(deck);
      const res = await get(query);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(renderOgPng).not.toHaveBeenCalled();
    },
  );

  it("is the same uncached 404 for a deck that is not public", async () => {
    fetchPresentationBySlug.mockResolvedValue(null);
    const res = await get(`?v=${VERSION}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("");
  });
});
