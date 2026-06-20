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
