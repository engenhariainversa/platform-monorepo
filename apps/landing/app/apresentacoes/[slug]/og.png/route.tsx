import { fetchPresentationBySlug } from "../../../../lib/fetch-presentation";
import { pngResponse, renderOgPng } from "../../../../lib/og-image";
import { DECK_CARD_CACHE, coverInfo, isCurrentImageVersion } from "../../../../lib/presentation-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

/**
 * The share card of a public deck (og:image / twitter:image), served only
 * under its current `?v=` (see isCurrentImageVersion) and cached at the edge
 * for DECK_CARD_CACHE. Anything that is not public — private, members-only,
 * trashed or nonexistent — and any other version is the same uncached empty
 * 404, so the image cannot be used to probe for a private deck's title.
 * Private decks show the fixed card in PRIVATE_CARD_PATH instead.
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const presentation = await fetchPresentationBySlug(params.slug);
  const version = new URL(request.url).searchParams.get("v");
  if (!presentation || !isCurrentImageVersion(presentation, version)) return notFound();
  return pngResponse(await renderOgPng(coverInfo(presentation)), DECK_CARD_CACHE);
}
