"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveSession, useQuery, useSendReaction } from "@repo/graphql/react";
import { GET_SOCIAL_LINKS, getUploadUrl } from "@repo/graphql";
import type { Presentation, SocialLink } from "@repo/types";
import {
  FollowButton,
  INITIAL_FOLLOW_STATE,
  LiveBadge,
  PointerLayer,
  PresentationPlayer,
  PrintDeck,
  ReactionBar,
  ReactionsLayer,
  followReducer,
  needsDeckRefresh,
  showFollowButton,
  visibleSlides,
  type PlayerSlide,
  type SlideContext,
} from "@repo/ui";

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

/**
 * Public player. When the presenter is live it follows their slide by default,
 * shows their laser and everyone's reactions; navigating by hand enters free
 * mode and "Seguir apresentador" brings the viewer back. Notes never reach
 * this page (the API strips them).
 */
export function PublicDeck({ presentation }: { presentation: Presentation }) {
  const router = useRouter();
  const { slides, context } = usePublicDeck(presentation);
  const live = useLiveSession(presentation.slug);
  const sendReaction = useSendReaction(presentation.slug);
  const [follow, dispatch] = useReducer(followReducer, INITIAL_FOLLOW_STATE);
  const [reactionsHidden, setReactionsHidden] = useState(false);
  const refreshedFor = useRef<string | null>(null);

  const presenterSlideId = live.isLive ? live.slideId : null;
  useEffect(() => {
    dispatch({ type: "presenter", slideId: presenterSlideId });
  }, [presenterSlideId]);

  // The presenter is on a slide added after this page loaded: fetch the deck
  // again (once per slide). Until it arrives the viewer simply stays put.
  const slideIds = useMemo(() => visibleSlides(slides).map((slide) => slide.id), [slides]);
  useEffect(() => {
    if (!needsDeckRefresh(presenterSlideId, slideIds)) return;
    if (refreshedFor.current === presenterSlideId) return;
    refreshedFor.current = presenterSlideId;
    router.refresh();
  }, [presenterSlideId, slideIds, router]);

  const onPresenterSlide = presenterSlideId !== null && follow.viewerSlideId === presenterSlideId;

  const overlay = live.isLive ? (
    <>
      {onPresenterSlide && <PointerLayer pointer={live.pointer} />}
      {!reactionsHidden && <ReactionsLayer lastReactions={live.lastReactions} />}
    </>
  ) : undefined;

  const chrome = live.isLive ? (
    <>
      <div className="absolute left-4 top-4">
        <LiveBadge viewerCount={live.showViewerCount ? live.viewerCount : null} />
      </div>
      {showFollowButton(follow) && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2">
          <FollowButton onClick={() => dispatch({ type: "follow" })} />
        </div>
      )}
      <ReactionBar
        onReact={sendReaction}
        hidden={reactionsHidden}
        onToggleHidden={() => setReactionsHidden((value) => !value)}
      />
    </>
  ) : undefined;

  return (
    <PresentationPlayer
      presentationId={`view:${presentation.id}`}
      slides={slides}
      context={context}
      onSlideChange={(_index, slide) => dispatch({ type: "viewer", slideId: slide.id })}
      followSlideId={follow.following ? presenterSlideId : null}
      overlay={overlay}
      chrome={chrome}
    />
  );
}

export function PublicPrint({ presentation }: { presentation: Presentation }) {
  const { slides, context, loading } = usePublicDeck(presentation);
  if (loading) return null;
  return <PrintDeck slides={slides} context={context} />;
}
