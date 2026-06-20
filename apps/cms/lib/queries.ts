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

export const ME = `
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

export const GET_USERS = `
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

export const CREATE_USER = `
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

export const UPDATE_USER_ROLE = `
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

export const DELETE_USER = `
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;

// ── Content: Live ───────────────────────────────────

export const GET_LIVE = `
  query GetLive {
    live {
      id
      label
      title
      description
      buttonText
      buttonUrl
      thumbnailUrl
      isLive
      viewersCount
    }
  }
`;

export const UPSERT_LIVE = `
  mutation UpsertLive($input: UpsertLiveInput!) {
    upsertLive(input: $input) {
      id
      label
      title
      description
      buttonText
      buttonUrl
      thumbnailUrl
      isLive
      viewersCount
    }
  }
`;

// ── Content: Episodes ───────────────────────────────

export const GET_EPISODES = `
  query GetEpisodes {
    episodes {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const CREATE_EPISODE = `
  mutation CreateEpisode($input: CreateEpisodeInput!) {
    createEpisode(input: $input) {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const UPDATE_EPISODE = `
  mutation UpdateEpisode($id: String!, $input: UpdateEpisodeInput!) {
    updateEpisode(id: $id, input: $input) {
      id
      module
      title
      duration
      imageUrl
      order
    }
  }
`;

export const DELETE_EPISODE = `
  mutation DeleteEpisode($id: String!) {
    deleteEpisode(id: $id)
  }
`;

export const REORDER_EPISODES = `
  mutation ReorderEpisodes($ids: [String!]!) {
    reorderEpisodes(ids: $ids) {
      id
      order
    }
  }
`;

// ── Roles ───────────────────────────────────────────

export const GET_ROLES = `
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

export const CREATE_ROLE = `
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
      name
      label
      description
    }
  }
`;

export const UPDATE_ROLE = `
  mutation UpdateRole($id: String!, $input: UpdateRoleInput!) {
    updateRole(id: $id, input: $input) {
      id
      label
      description
    }
  }
`;

export const DELETE_ROLE = `
  mutation DeleteRole($id: String!) {
    deleteRole(id: $id)
  }
`;

// ── Permissions ─────────────────────────────────────

export const GET_PERMISSIONS_FOR_ROLE = `
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

export const GET_PUBLIC_RESOURCES = `
  query GetPublicResources {
    publicResources {
      id
      resource
    }
  }
`;

export const TOGGLE_PERMISSION = `
  mutation TogglePermission($input: TogglePermissionInput!) {
    togglePermission(input: $input)
  }
`;

export const TOGGLE_PUBLIC_RESOURCE = `
  mutation TogglePublicResource($input: TogglePublicResourceInput!) {
    togglePublicResource(input: $input)
  }
`;

