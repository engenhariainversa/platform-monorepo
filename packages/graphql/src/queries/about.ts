import { gql } from "@apollo/client";

export const GET_ABOUT_SECTION = gql`
  query GetAboutSection {
    aboutSection {
      id
      title
      body
      stat1Value
      stat1Label
      stat2Value
      stat2Label
    }
  }
`;

export const UPSERT_ABOUT_SECTION = gql`
  mutation UpsertAboutSection($input: UpsertAboutSectionInput!) {
    upsertAboutSection(input: $input) {
      id
      title
      body
      stat1Value
      stat1Label
      stat2Value
      stat2Label
    }
  }
`;
