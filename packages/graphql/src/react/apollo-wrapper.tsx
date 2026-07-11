"use client";

import { useState, type ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { createApolloClient, getAuthToken, GRAPHQL_URL } from "../client";

export type ApolloWrapperProps = {
  children: ReactNode;
  /** GraphQL endpoint override. Defaults to the shared `GRAPHQL_URL`. */
  uri?: string;
  /**
   * Name of the cookie holding a bearer token. When provided, requests are
   * authenticated with that token (used by the CMS); omit for public apps
   * like the landing. A string keeps this prop serializable across the
   * Server/Client Component boundary.
   */
  tokenCookieName?: string;
};

/**
 * Shared Apollo provider for the frontends. Instantiates the client once (lazy
 * `useState` initializer) and exposes it via context so components can use the
 * `useQuery`/`useMutation` hooks.
 */
export function ApolloWrapper({
  children,
  uri = GRAPHQL_URL,
  tokenCookieName,
}: ApolloWrapperProps) {
  const [client] = useState(() =>
    createApolloClient({
      uri,
      getToken: tokenCookieName
        ? () => getAuthToken(tokenCookieName)
        : undefined,
    }),
  );
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
