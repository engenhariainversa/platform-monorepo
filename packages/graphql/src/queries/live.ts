import { gql } from "@apollo/client";

export const GET_LIVE = gql`
  query GetLive {
    live {
      id
      label
      title
      description
      buttonText
      buttonUrl
      thumbnailUrl
      isLive
      viewersCount
    }
  }
`;

export const UPSERT_LIVE = gql`
  mutation UpsertLive($input: UpsertLiveInput!) {
    upsertLive(input: $input) {
      id
      label
      title
      description
      buttonText
      buttonUrl
      thumbnailUrl
      isLive
      viewersCount
    }
  }
`;
