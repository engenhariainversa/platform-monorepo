import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { removeTypenameFromVariables } from "@apollo/client/link/remove-typename";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getViewerId, isSocketOperation, retryDelayMs, shouldRetrySocket, toWsUrl } from "./ws";

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
  /**
   * Enables live sessions: subscriptions (and the `MovePointer` / `SendReaction`
   * mutations) go over a websocket derived from `uri`. `onClosed` receives the
   * close code; 4403 means the credential was revoked or expired.
   */
  live?: boolean | { onClosed?: (code: number) => void };
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

  const httpChain = from([removeTypenameLink, authLink, httpLink]);

  // The socket only exists in the browser, and only connects on first use (lazy).
  let link: ApolloLink = httpChain;
  if (options.live && typeof window !== "undefined") {
    const onClosed = typeof options.live === "object" ? options.live.onClosed : undefined;
    const wsLink = new GraphQLWsLink(
      createClient({
        url: toWsUrl(options.uri),
        lazy: true,
        // Client ping every 30 s, below Cloudflare's ~100 s idle timeout.
        keepAlive: 30_000,
        retryAttempts: Infinity,
        // graphql-ws' default wait is 2^retries seconds with no ceiling.
        retryWait: async (retries) => {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(retries)));
        },
        shouldRetry: shouldRetrySocket,
        connectionParams: () => {
          const token = options.getToken?.();
          return {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            viewerId: getViewerId(),
          };
        },
        on: {
          closed: (event) => {
            const code = (event as { code?: number } | null)?.code;
            if (typeof code === "number") onClosed?.(code);
          },
        },
      }),
    );
    link = ApolloLink.split(({ query }) => isSocketOperation(query), from([removeTypenameLink, wsLink]), httpChain);
  }

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    ssrMode: typeof window === "undefined",
  });
}
