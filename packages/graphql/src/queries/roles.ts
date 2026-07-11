import { gql } from "@apollo/client";

export const GET_ROLES = gql`
  query GetRoles {
    roles {
      id
      name
      label
      description
      isSystem
      isAdmin
      userCount
    }
  }
`;

export const CREATE_ROLE = gql`
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
      name
      label
      description
    }
  }
`;

export const UPDATE_ROLE = gql`
  mutation UpdateRole($id: String!, $input: UpdateRoleInput!) {
    updateRole(id: $id, input: $input) {
      id
      label
      description
    }
  }
`;

export const DELETE_ROLE = gql`
  mutation DeleteRole($id: String!) {
    deleteRole(id: $id)
  }
`;
