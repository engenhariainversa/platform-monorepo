export type FollowState = {
  following: boolean;
  /** null when no session is live */
  presenterSlideId: string | null;
  /** null until the player reports its first slide */
  viewerSlideId: string | null;
};

export type FollowAction =
  | { type: "presenter"; slideId: string | null }
  | { type: "viewer"; slideId: string }
  | { type: "follow" };

export const INITIAL_FOLLOW_STATE: FollowState = { following: true, presenterSlideId: null, viewerSlideId: null };

export function followReducer(state: FollowState, action: FollowAction): FollowState {
  switch (action.type) {
    case "presenter":
      // Session over: the next one is followed by default again.
      if (action.slideId === null) return { ...state, presenterSlideId: null, following: true };
      return { ...state, presenterSlideId: action.slideId };
    case "viewer": {
      const firstReport = state.viewerSlideId === null;
      const following =
        state.presenterSlideId === null
          ? true
          : firstReport
            ? state.following // the slide the page opened on is not a choice to leave the presenter
            : action.slideId === state.presenterSlideId;
      return { ...state, viewerSlideId: action.slideId, following };
    }
    case "follow":
      return { ...state, following: true };
    default:
      return state;
  }
}

/** Visible exactly when the viewer's slide differs from the presenter's. */
export function showFollowButton(state: FollowState): boolean {
  return (
    state.presenterSlideId !== null &&
    state.viewerSlideId !== null &&
    state.viewerSlideId !== state.presenterSlideId
  );
}

/** Index to jump to, or null to stay put (not following, or a slide this page does not have). */
export function followTargetIndex(slideIds: string[], followSlideId: string | null | undefined): number | null {
  if (!followSlideId) return null;
  const index = slideIds.indexOf(followSlideId);
  return index >= 0 ? index : null;
}

/** The presenter is on a slide added (or un-hidden) after this page loaded its deck. */
export function needsDeckRefresh(presenterSlideId: string | null, slideIds: string[]): boolean {
  return presenterSlideId !== null && !slideIds.includes(presenterSlideId);
}
