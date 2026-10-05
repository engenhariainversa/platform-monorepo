"use client";

import { useParams } from "next/navigation";
import { PresenterView } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <PresenterView presentationId={presentation.id} title={presentation.title} slides={slides} context={context} />;
}
