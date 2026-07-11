import { gql } from "@apollo/client";

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      firstName
      lastName
      email
      username
      role {
        id
        name
        label
      }
      createdAt
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      firstName
      lastName
      email
      username
      role {
        id
        name
        label
      }
    }
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($id: String!, $roleName: String!) {
    updateUserRole(id: $id, roleName: $roleName) {
      id
      role {
        id
        name
        label
      }
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;
