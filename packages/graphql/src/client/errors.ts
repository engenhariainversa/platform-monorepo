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
