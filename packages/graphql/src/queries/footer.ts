import { gql } from "@apollo/client";

export const GET_FOOTER_SECTION = gql`
  query GetFooterSection {
    footerSection {
      id
      newsletterEnabled
    }
  }
`;

export const UPSERT_FOOTER_SECTION = gql`
  mutation UpsertFooterSection($input: UpsertFooterSectionInput!) {
    upsertFooterSection(input: $input) {
      id
      newsletterEnabled
    }
  }
`;
