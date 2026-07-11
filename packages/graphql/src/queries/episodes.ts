import { gql } from "@apollo/client";

export const GET_EPISODES = gql`
  query GetEpisodes {
    episodes {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const CREATE_EPISODE = gql`
  mutation CreateEpisode($input: CreateEpisodeInput!) {
    createEpisode(input: $input) {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const UPDATE_EPISODE = gql`
  mutation UpdateEpisode($id: String!, $input: UpdateEpisodeInput!) {
    updateEpisode(id: $id, input: $input) {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const DELETE_EPISODE = gql`
  mutation DeleteEpisode($id: String!) {
    deleteEpisode(id: $id)
  }
`;

export const REORDER_EPISODES = gql`
  mutation ReorderEpisodes($ids: [String!]!) {
    reorderEpisodes(ids: $ids) {
      id
      order
    }
  }
`;
