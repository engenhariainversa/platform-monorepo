import { gql } from "@apollo/client";

export const GET_FOOTER_SECTION = gql`
  query GetFooterSection {
    footerSection {
      id
      newsletterEnabled
      socialLinksEnabled
    }
  }
`;

export const UPSERT_FOOTER_SECTION = gql`
  mutation UpsertFooterSection($input: UpsertFooterSectionInput!) {
    upsertFooterSection(input: $input) {
      id
      newsletterEnabled
      socialLinksEnabled
    }
  }
`;

export const GET_SOCIAL_LINKS = gql`
  query GetSocialLinks {
    socialLinks {
      id
      label
      url
      order
    }
  }
`;

export const CREATE_SOCIAL_LINK = gql`
  mutation CreateSocialLink($input: CreateSocialLinkInput!) {
    createSocialLink(input: $input) {
      id
      label
      url
      order
    }
  }
`;

export const UPDATE_SOCIAL_LINK = gql`
  mutation UpdateSocialLink($id: String!, $input: UpdateSocialLinkInput!) {
    updateSocialLink(id: $id, input: $input) {
      id
      label
      url
      order
    }
  }
`;

export const DELETE_SOCIAL_LINK = gql`
  mutation DeleteSocialLink($id: String!) {
    deleteSocialLink(id: $id)
  }
`;

export const REORDER_SOCIAL_LINKS = gql`
  mutation ReorderSocialLinks($ids: [String!]!) {
    reorderSocialLinks(ids: $ids) {
      id
      order
    }
  }
`;
