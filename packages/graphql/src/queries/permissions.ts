import { gql } from "@apollo/client";

export const GET_PERMISSIONS_FOR_ROLE = gql`
  query GetPermissionsForRole($roleId: String!) {
    permissionsForRole(roleId: $roleId) {
      resource
      create
      read
      update
      delete
    }
  }
`;

export const GET_PUBLIC_RESOURCES = gql`
  query GetPublicResources {
    publicResources {
      id
      resource
    }
  }
`;

export const TOGGLE_PERMISSION = gql`
  mutation TogglePermission($input: TogglePermissionInput!) {
    togglePermission(input: $input)
  }
`;

export const TOGGLE_PUBLIC_RESOURCE = gql`
  mutation TogglePublicResource($input: TogglePublicResourceInput!) {
    togglePublicResource(input: $input)
  }
`;
