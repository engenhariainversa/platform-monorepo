"use client";

import { useParams } from "next/navigation";
import { useLiveSession, usePresenterControls } from "@repo/graphql/react";
import type { Presentation } from "@repo/types";
import { LivePresenterView, type PlayerSlide, type SlideContext } from "@repo/ui";
import { useDeck } from "../../../../components/presentations/use-deck";

function LiveView({
  presentation,
  slides,
  context,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
}) {
  const live = useLiveSession(presentation.visibility === "PUBLIC" ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);
  return (
    <LivePresenterView
      presentationId={presentation.id}
      title={presentation.title}
      slides={slides}
      context={context}
      live={live}
      controls={controls}
    />
  );
}

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <LiveView presentation={presentation} slides={slides} context={context} />;
}
