import { gql } from "@apollo/client";
import { PRESENTATION_FIELDS } from "./presentations";

const LIVE_STATE_FIELDS = `
  isLive
  startedAt
  slideId
  showViewerCount
  showReactionsOnScreen
  viewerCount
  peakViewers
  reactionTotals { kind count }
`;

const PRESENTER_LINK_FIELDS = `
  id
  name
  prefix
  expiresAt
  lastUsedAt
  revokedAt
  createdAt
`;

export const GET_LIVE_STATE = gql`
  query GetLiveState($slug: String!) {
    liveState(slug: $slug) { ${LIVE_STATE_FIELDS} }
  }
`;

export const LIVE_EVENTS = gql`
  subscription LiveEvents($slug: String!) {
    liveEvents(slug: $slug) {
      type
      slideId
      pointer { x y visible }
      viewerCount
      peakViewers
      reactions { kind count }
      showViewerCount
      showReactionsOnScreen
    }
  }
`;

export const START_LIVE = gql`
  mutation StartLive($presentationId: ID!, $slideId: ID!) {
    startLive(presentationId: $presentationId, slideId: $slideId) { ${LIVE_STATE_FIELDS} }
  }
`;

export const STOP_LIVE = gql`
  mutation StopLive($presentationId: ID!) {
    stopLive(presentationId: $presentationId)
  }
`;

export const SET_LIVE_SLIDE = gql`
  mutation SetLiveSlide($presentationId: ID!, $slideId: ID!) {
    setLiveSlide(presentationId: $presentationId, slideId: $slideId)
  }
`;

// Operation name "MovePointer" is in SOCKET_OPERATIONS: sent over the websocket.
export const MOVE_POINTER = gql`
  mutation MovePointer($presentationId: ID!, $x: Float!, $y: Float!, $visible: Boolean!) {
    movePointer(presentationId: $presentationId, x: $x, y: $y, visible: $visible)
  }
`;

export const SET_LIVE_OPTIONS = gql`
  mutation SetLiveOptions($presentationId: ID!, $showViewerCount: Boolean, $showReactionsOnScreen: Boolean) {
    setLiveOptions(
      presentationId: $presentationId
      showViewerCount: $showViewerCount
      showReactionsOnScreen: $showReactionsOnScreen
    ) { ${LIVE_STATE_FIELDS} }
  }
`;

// Operation name "SendReaction" is in SOCKET_OPERATIONS: the server rate-limits per socket.
export const SEND_REACTION = gql`
  mutation SendReaction($slug: String!, $kind: ReactionKind!) {
    sendReaction(slug: $slug, kind: $kind)
  }
`;

export const GET_PRESENTER_LINKS = gql`
  query GetPresenterLinks($presentationId: ID!) {
    presenterLinks(presentationId: $presentationId) { ${PRESENTER_LINK_FIELDS} }
  }
`;

export const CREATE_PRESENTER_LINK = gql`
  mutation CreatePresenterLink($presentationId: ID!, $name: String!, $expiresIn: PresenterLinkExpiry!) {
    createPresenterLink(presentationId: $presentationId, name: $name, expiresIn: $expiresIn) {
      url
      presenterLink { ${PRESENTER_LINK_FIELDS} }
    }
  }
`;

export const REVOKE_PRESENTER_LINK = gql`
  mutation RevokePresenterLink($id: ID!) {
    revokePresenterLink(id: $id) { ${PRESENTER_LINK_FIELDS} }
  }
`;

export const GET_PRESENTATION_FOR_PRESENTER = gql`
  query GetPresentationForPresenter {
    presentationForPresenter { ${PRESENTATION_FIELDS} }
  }
`;
