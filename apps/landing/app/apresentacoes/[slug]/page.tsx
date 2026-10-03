import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPresentationBySlug } from "../../../lib/fetch-presentation";
import { PublicDeck } from "../../../components/public-deck";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) return { title: "Apresentação não encontrada | Engenharia Inversa" };
  return {
    title: `${presentation.title} | Engenharia Inversa`,
    description: presentation.description ?? undefined,
  };
}

export default async function PresentationPage({ params }: Props) {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) notFound();
  return <PublicDeck presentation={presentation} />;
}
