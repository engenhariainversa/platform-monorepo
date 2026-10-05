"use client";

import { useMemo } from "react";
import { useQuery } from "@repo/graphql/react";
import { GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import { PresentationPlayer, PrintDeck, type PlayerSlide, type SlideContext } from "@repo/ui";

function usePublicDeck(presentation: Presentation) {
  const { data, loading } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);
  const slides = useMemo<PlayerSlide[]>(
    () =>
      [...presentation.slides]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, template: s.template, content: s.content, notes: null, hidden: s.hidden })),
    [presentation],
  );
  const context = useMemo<SlideContext>(
    () => ({
      socialLinks: [...(data?.socialLinks ?? [])].sort((a, b) => a.order - b.order),
      resolveUrl: (url) => getUploadUrl(url),
    }),
    [data],
  );
  return { slides, context, loading };
}

/** Public player: no presenter view, notes never present (the API strips them). */
export function PublicDeck({ presentation }: { presentation: Presentation }) {
  const { slides, context } = usePublicDeck(presentation);
  return <PresentationPlayer presentationId={presentation.id} slides={slides} context={context} />;
}

export function PublicPrint({ presentation }: { presentation: Presentation }) {
  const { slides, context, loading } = usePublicDeck(presentation);
  if (loading) return null;
  return <PrintDeck slides={slides} context={context} />;
}
