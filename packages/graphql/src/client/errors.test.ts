import { describe, expect, it } from "vitest";
import { isUnauthenticatedError } from "./errors";

describe("isUnauthenticatedError", () => {
  it("recognises a GraphQL UNAUTHENTICATED error in Apollo's error shapes", () => {
    const graphQLError = { message: "Link revogado ou expirado", extensions: { code: "UNAUTHENTICATED" } };
    expect(isUnauthenticatedError({ errors: [graphQLError] })).toBe(true); // CombinedGraphQLErrors (Apollo 4)
    expect(isUnauthenticatedError({ graphQLErrors: [graphQLError] })).toBe(true); // ApolloError (Apollo 3)
  });
  it("does not mistake other failures for a dead link", () => {
    expect(isUnauthenticatedError(new Error("Failed to fetch"))).toBe(false);
    expect(isUnauthenticatedError({ errors: [{ message: "x", extensions: { code: "BAD_USER_INPUT" } }] })).toBe(false);
    expect(isUnauthenticatedError(undefined)).toBe(false);
    expect(isUnauthenticatedError(null)).toBe(false);
  });
});
