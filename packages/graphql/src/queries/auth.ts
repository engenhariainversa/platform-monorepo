import { gql } from "@apollo/client";

export const HAS_ADMIN = gql`
  query HasAdmin {
    hasAdmin
  }
`;

export const SETUP_ADMIN = gql`
  mutation SetupAdmin($input: SetupAdminInput!) {
    setupAdmin(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        username
        role {
          id
          name
          label
          isAdmin
        }
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        username
        role {
          id
          name
          label
          isAdmin
        }
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      firstName
      lastName
      email
      username
      role {
        id
        name
        label
        isAdmin
      }
    }
  }
`;
