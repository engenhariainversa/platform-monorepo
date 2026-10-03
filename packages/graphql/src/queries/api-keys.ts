import { gql } from "@apollo/client";

const API_KEY_FIELDS = `
  id
  name
  prefix
  expiresAt
  lastUsedAt
  revokedAt
  createdAt
`;

export const GET_API_KEYS = gql`
  query GetApiKeys {
    apiKeys { ${API_KEY_FIELDS} }
  }
`;

export const CREATE_API_KEY = gql`
  mutation CreateApiKey($name: String!, $expiresIn: ApiKeyExpiry!) {
    createApiKey(name: $name, expiresIn: $expiresIn) {
      token
      apiKey { ${API_KEY_FIELDS} }
    }
  }
`;

export const REVOKE_API_KEY = gql`
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id) { ${API_KEY_FIELDS} }
  }
`;
