"use client";

import { useParams } from "next/navigation";
import { PresentationPlayer } from "@repo/ui";
import { useDeck } from "../../../components/presentations/use-deck";

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return (
    <PresentationPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref={`/apresentar/${presentation.id}/apresentador`}
    />
  );
}
