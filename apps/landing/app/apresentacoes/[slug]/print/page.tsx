import { notFound } from "next/navigation";
import { fetchPresentationBySlug } from "../../../../lib/fetch-presentation";
import { PublicPrint } from "../../../../components/public-deck";

export const dynamic = "force-dynamic";

export default async function PresentationPrintPage({ params }: { params: { slug: string } }) {
  const presentation = await fetchPresentationBySlug(params.slug);
  if (!presentation) notFound();
  return <PublicPrint presentation={presentation} />;
}
