import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OgCard } from "./og-card";
import { OG_IMAGE_SIZE, type CoverInfo } from "./presentation-meta";

type Assets = { mascotSrc: string; fonts: { name: string; data: Buffer; weight: 600 | 800; style: "normal" }[] };

// Read once per process. `next dev` and `next start` both run from apps/landing,
// and the runtime image ships `public/`, so the files are always on disk.
let assets: Promise<Assets> | null = null;

function loadAssets(): Promise<Assets> {
  const publicDir = path.join(process.cwd(), "public");
  assets ??= Promise.all([
    readFile(path.join(publicDir, "images/logo-mascot.png")),
    readFile(path.join(publicDir, "fonts/sora-latin-600-normal.woff")),
    readFile(path.join(publicDir, "fonts/sora-latin-800-normal.woff")),
  ]).then(
    ([mascot, sora600, sora800]) => ({
      mascotSrc: `data:image/png;base64,${mascot.toString("base64")}`,
      fonts: [
        { name: "Sora", data: sora600, weight: 600, style: "normal" },
        { name: "Sora", data: sora800, weight: 800, style: "normal" },
      ],
    }),
    (error) => {
      assets = null;
      throw error;
    },
  );
  return assets;
}

/**
 * The share card as PNG bytes. ImageResponse renders lazily, inside its body
 * stream: a failure there surfaces as a 200 with a truncated body. Rendering
 * to a buffer first turns it into a 500 a scraper will not cache as the card
 * (docs/lessons/2026-11-23-next-og-gradient-stop-without-unit.md).
 */
export async function renderOgPng(cover: CoverInfo): Promise<ArrayBuffer> {
  const { mascotSrc, fonts } = await loadAssets();
  const image = new ImageResponse(<OgCard cover={cover} mascotSrc={mascotSrc} />, { ...OG_IMAGE_SIZE, fonts });
  return image.arrayBuffer();
}

/** A PNG response with the given Cache-Control (ImageResponse's own default is a one-year immutable cache). */
export function pngResponse(png: ArrayBuffer, cacheControl: string): Response {
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": cacheControl } });
}

/**
 * Route handler for a fixed card (no deck data in it): rendered once per
 * process and cacheable anywhere, since it is the same for every request.
 */
export function staticCardHandler(cover: CoverInfo) {
  let png: Promise<ArrayBuffer> | null = null;
  return async function GET(): Promise<Response> {
    png ??= renderOgPng(cover).catch((error: unknown) => {
      png = null;
      throw error;
    });
    return pngResponse(await png, STATIC_CARD_CACHE);
  };
}

/** Fixed cards: a day in browsers and at the Cloudflare edge. */
export const STATIC_CARD_CACHE = "public, max-age=86400, s-maxage=86400";
