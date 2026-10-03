import { gql } from "@apollo/client";

const SLIDE_FIELDS = `
  id
  order
  template
  content
  notes
  hidden
`;

export const PRESENTATION_FIELDS = `
  id
  slug
  title
  description
  visibility
  slideCount
  deletedAt
  createdAt
  updatedAt
  slides { ${SLIDE_FIELDS} }
`;

export const GET_PRESENTATIONS = gql`
  query GetPresentations($trash: Boolean) {
    presentations(trash: $trash) { ${PRESENTATION_FIELDS} }
  }
`;

export const GET_PRESENTATION = gql`
  query GetPresentation($id: ID!) {
    presentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const GET_PRESENTATION_BY_SLUG = gql`
  query GetPresentationBySlug($slug: String!) {
    presentationBySlug(slug: $slug) { ${PRESENTATION_FIELDS} }
  }
`;

export const CREATE_PRESENTATION = gql`
  mutation CreatePresentation($input: CreatePresentationInput!) {
    createPresentation(input: $input) { ${PRESENTATION_FIELDS} }
  }
`;

export const UPDATE_PRESENTATION = gql`
  mutation UpdatePresentation($id: ID!, $input: UpdatePresentationInput!) {
    updatePresentation(id: $id, input: $input) { ${PRESENTATION_FIELDS} }
  }
`;

export const DUPLICATE_PRESENTATION = gql`
  mutation DuplicatePresentation($id: ID!) {
    duplicatePresentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const DELETE_PRESENTATION = gql`
  mutation DeletePresentation($id: ID!) {
    deletePresentation(id: $id)
  }
`;

export const RESTORE_PRESENTATION = gql`
  mutation RestorePresentation($id: ID!) {
    restorePresentation(id: $id) { ${PRESENTATION_FIELDS} }
  }
`;

export const PURGE_PRESENTATION = gql`
  mutation PurgePresentation($id: ID!) {
    purgePresentation(id: $id)
  }
`;

export const REPLACE_SLIDES = gql`
  mutation ReplaceSlides($presentationId: ID!, $slides: [SlideInput!]!) {
    replaceSlides(presentationId: $presentationId, slides: $slides) { ${PRESENTATION_FIELDS} }
  }
`;

export const CREATE_SLIDE = gql`
  mutation CreateSlide($presentationId: ID!, $input: SlideInput!, $position: Int) {
    createSlide(presentationId: $presentationId, input: $input, position: $position) { ${SLIDE_FIELDS} }
  }
`;

export const UPDATE_SLIDE = gql`
  mutation UpdateSlide($id: ID!, $input: UpdateSlideInput!) {
    updateSlide(id: $id, input: $input) { ${SLIDE_FIELDS} }
  }
`;

export const DELETE_SLIDE = gql`
  mutation DeleteSlide($id: ID!) {
    deleteSlide(id: $id)
  }
`;

export const REORDER_SLIDES = gql`
  mutation ReorderSlides($presentationId: ID!, $ids: [ID!]!) {
    reorderSlides(presentationId: $presentationId, ids: $ids) { id order }
  }
`;
