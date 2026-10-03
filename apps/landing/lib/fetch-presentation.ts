import { cache } from "react";
import { GET_PRESENTATION_BY_SLUG, documentText } from "@repo/graphql";
import type { Presentation } from "@repo/types";

type GraphQLErrorLike = {
  message: string;
  extensions?: { code?: string; originalError?: { statusCode?: number } };
};

function isUnauthorized(error: GraphQLErrorLike): boolean {
  return (
    error.extensions?.code === "UNAUTHENTICATED" ||
    error.extensions?.originalError?.statusCode === 401
  );
}

function graphqlEndpoint(): string {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
  const path = process.env.NEXT_PUBLIC_GRAPHQL_PATH ?? "/graphql";
  return `${base}${path}`;
}

/**
 * The public deck, or null when it does not exist or is not public (the API
 * answers 401 for private, members-only and trashed decks). Cached per request
 * so generateMetadata and the page share one fetch.
 */
export const fetchPresentationBySlug = cache(async (slug: string): Promise<Presentation | null> => {
  const res = await fetch(graphqlEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: documentText(GET_PRESENTATION_BY_SLUG), variables: { slug } }),
    cache: "no-store",
  });
  if (!res.ok && res.status !== 401) {
    throw new Error(`Presentation fetch failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { presentationBySlug: Presentation | null } | null;
    errors?: GraphQLErrorLike[];
  };
  if (json.errors?.length) {
    if (json.errors.some(isUnauthorized)) return null;
    throw new Error(json.errors[0].message);
  }
  return json.data?.presentationBySlug ?? null;
});
