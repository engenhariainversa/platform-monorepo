// GraphQL queries and mutations for the CMS

export const HAS_ADMIN = `
  query HasAdmin {
    hasAdmin
  }
`;

export const SETUP_ADMIN = `
  mutation SetupAdmin($input: SetupAdminInput!) {
    setupAdmin(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        username
        role
      }
    }
  }
`;

export const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        username
        role
      }
    }
  }
`;

export const ME = `
  query Me {
    me {
      id
      firstName
      lastName
      email
      username
      role
    }
  }
`;

export const GET_USERS = `
  query GetUsers {
    users {
      id
      firstName
      lastName
      email
      username
      role
      createdAt
    }
  }
`;

export const CREATE_USER = `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      firstName
      lastName
      email
      username
      role
    }
  }
`;

export const UPDATE_USER_ROLE = `
  mutation UpdateUserRole($id: String!, $role: Role!) {
    updateUserRole(id: $id, role: $role) {
      id
      role
    }
  }
`;

export const DELETE_USER = `
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;
