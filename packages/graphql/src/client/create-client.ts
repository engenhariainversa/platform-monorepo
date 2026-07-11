import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename";

/** Next.js augments fetch options with a `next` field for caching/revalidation. */
type FetchOptions = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

export type CreateApolloClientOptions = {
  /** GraphQL endpoint, e.g. `http://localhost:4050/graphql`. */
  uri: string;
  /**
   * Optional bearer-token provider. Authenticated apps (the CMS) pass a
   * function that reads the token; public apps (the landing) omit it.
   */
  getToken?: () => string | null | undefined;
  /** Extra fetch options, e.g. Next.js `{ next: { revalidate: 60 } }`. */
  fetchOptions?: FetchOptions;
};

/**
 * Builds an Apollo Client instance shared across the frontends.
 *
 * - The landing calls this per server request (public, no token).
 * - The CMS calls this once on the client, passing a cookie-backed `getToken`.
 */
export function createApolloClient(
  options: CreateApolloClientOptions,
): ApolloClient {
  const httpLink = new HttpLink({
    uri: options.uri,
    fetchOptions: options.fetchOptions,
  });

  const authLink = setContext((_operation, prevContext) => {
    const token = options.getToken?.();
    if (!token) return prevContext;
    return {
      ...prevContext,
      headers: {
        ...(prevContext.headers ?? {}),
        authorization: `Bearer ${token}`,
      },
    };
  });

  // Strip the `__typename` field Apollo's cache injects into query results, so
  // objects read back from the cache can be reused as mutation variables without
  // leaking `__typename` to the backend (NestJS input types reject unknown keys).
  const removeTypenameLink = removeTypenameFromVariables();

  return new ApolloClient({
    link: from([removeTypenameLink, authLink, httpLink]),
    cache: new InMemoryCache(),
    ssrMode: typeof window === "undefined",
  });
}
