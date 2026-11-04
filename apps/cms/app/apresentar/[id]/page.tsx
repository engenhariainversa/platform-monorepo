"use client";

import { useParams } from "next/navigation";
import { useLiveSession, usePresenterControls } from "@repo/graphql/react";
import type { Presentation } from "@repo/types";
import { LivePresenterPlayer, type PlayerSlide, type SlideContext } from "@repo/ui";
import { useDeck } from "../../../components/presentations/use-deck";

// Hooks cannot run before the deck is loaded, hence the inner component.
function LiveDeck({
  presentation,
  slides,
  context,
}: {
  presentation: Presentation;
  slides: PlayerSlide[];
  context: SlideContext;
}) {
  const isPublic = presentation.visibility === "PUBLIC";
  // Presenters poll every 5 s: after a backend restart the session is re-asserted quickly.
  const live = useLiveSession(isPublic ? presentation.slug : null, { pollMs: 5000 });
  const controls = usePresenterControls(presentation.id);
  return (
    <LivePresenterPlayer
      presentationId={presentation.id}
      slides={slides}
      context={context}
      presenterHref={`/apresentar/${presentation.id}/apresentador`}
      isPublic={isPublic}
      live={live}
      controls={controls}
    />
  );
}

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, slides, context, loading } = useDeck(id);

  if (loading && !presentation) return null;
  if (!presentation) {
    return <p className="p-8 text-on-surface-variant">Apresentação não encontrada.</p>;
  }
  return <LiveDeck presentation={presentation} slides={slides} context={context} />;
}
