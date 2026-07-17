import { gql } from "@apollo/client";

export const GET_HERO_SECTION = gql`
  query GetHeroSection {
    heroSection {
      id
      title
      subtitle
      buttonText
      buttonUrl
    }
  }
`;

export const UPSERT_HERO_SECTION = gql`
  mutation UpsertHeroSection($input: UpsertHeroSectionInput!) {
    upsertHeroSection(input: $input) {
      id
      title
      subtitle
      buttonText
      buttonUrl
    }
  }
`;
