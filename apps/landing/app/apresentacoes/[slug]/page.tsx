import type { Metadata } from "next";
import { fetchPresentationBySlug } from "../../../lib/fetch-presentation";
import { presentationMetadata } from "../../../lib/presentation-meta";
import { PublicDeck } from "../../../components/public-deck";
import { PrivateDeckNotice } from "../../../components/private-deck-notice";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const presentation = await fetchPresentationBySlug(params.slug);
  return presentationMetadata(presentation);
}

export default async function PresentationPage({ params }: Props) {
  const presentation = await fetchPresentationBySlug(params.slug);
  // A 200, not notFound(): see PrivateDeckNotice.
  if (!presentation) return <PrivateDeckNotice />;
  return <PublicDeck presentation={presentation} />;
}
