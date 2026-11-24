import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { fetchPresentationBySlug } from "../../../../lib/fetch-presentation";
import { OgCard } from "../../../../lib/og-card";
import { OG_IMAGE_SIZE, coverInfo } from "../../../../lib/presentation-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * The share card of a public deck (og:image / twitter:image). Anything that is
 * not public — private, members-only, trashed or nonexistent — is the same
 * empty 404, so the image cannot be used to probe for a private deck's title.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) {
    return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const { mascotSrc, fonts } = await loadAssets();
  const image = new ImageResponse(<OgCard cover={coverInfo(presentation)} mascotSrc={mascotSrc} />, {
    ...OG_IMAGE_SIZE,
    fonts,
  });
  // ImageResponse renders lazily, inside its body stream: a failure there
  // surfaces as a 200 with a truncated body. Rendering to a buffer first turns
  // it into a 500 a scraper will not cache as the card.
  const png = await image.arrayBuffer();
  return new Response(png, {
    headers: {
      "content-type": "image/png",
      // ImageResponse defaults to a one-year immutable cache. A deck can turn
      // private at any time, and a CDN copy would keep serving its title.
      "cache-control": "no-store",
    },
  });
}
