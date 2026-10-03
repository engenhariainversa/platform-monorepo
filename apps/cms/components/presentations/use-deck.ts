"use client";

import { useMemo } from "react";
import { useQuery } from "@repo/graphql/react";
import { GET_PRESENTATION, GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import type { PlayerSlide, SlideContext } from "@repo/ui";

// `fresh` skips the cache so the deck always reflects the server (used by print).
// `loading` stays true until both the presentation and the social links settle.
export function useDeck(id: string, options: { fresh?: boolean } = {}) {
  const { data, loading: presentationLoading } = useQuery<{ presentation: Presentation | null }>(GET_PRESENTATION, {
    variables: { id },
    fetchPolicy: options.fresh ? "network-only" : "cache-and-network",
  });
  const { data: social, loading: socialLoading } = useQuery<{ socialLinks: SocialLink[] }>(GET_SOCIAL_LINKS);

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

  return { presentation, slides, context, loading: presentationLoading || socialLoading };
}
