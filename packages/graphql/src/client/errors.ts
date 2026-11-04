import { CombinedGraphQLErrors } from "@apollo/client";

/** `extensions.code` of the first GraphQL error (e.g. "SLUG_TAKEN"), if any. */
export function graphQLErrorCode(error: unknown): string | undefined {
  if (CombinedGraphQLErrors.is(error)) {
    const code = error.errors[0]?.extensions?.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function graphQLErrorMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) return error.errors[0]?.message ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

type GraphQLErrorLike = { extensions?: { code?: unknown } };

/**
 * True when the API refused the credential (expired/revoked key, link or
 * session). A network failure is not that: callers keep retrying instead of
 * telling the user their link is dead.
 */
export function isUnauthenticatedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { errors, graphQLErrors } = error as { errors?: unknown; graphQLErrors?: unknown };
  const list = Array.isArray(errors) ? errors : Array.isArray(graphQLErrors) ? graphQLErrors : [];
  return list.some((e: GraphQLErrorLike) => e?.extensions?.code === "UNAUTHENTICATED");
}
