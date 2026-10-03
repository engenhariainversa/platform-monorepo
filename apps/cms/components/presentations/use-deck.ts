"use client";

import { useMemo } from "react";
import { useQuery } from "@repo/graphql/react";
import { GET_PRESENTATION, GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import type { PlayerSlide, SlideContext } from "@repo/ui";

export function useDeck(id: string) {
  const { data, loading } = useQuery<{ presentation: Presentation | null }>(GET_PRESENTATION, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const { data: social } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);

  const presentation = data?.presentation ?? null;
  const slides = useMemo<PlayerSlide[]>(
    () =>
      [...(presentation?.slides ?? [])]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, template: s.template, content: s.content, notes: s.notes, hidden: s.hidden })),
    [presentation],
  );
  const context = useMemo<SlideContext>(
    () => ({
      socialLinks: [...(social?.socialLinks ?? [])].sort((a, b) => a.order - b.order),
      resolveUrl: (url) => getUploadUrl(url),
    }),
    [social],
  );

  return { presentation, slides, context, loading };
}
