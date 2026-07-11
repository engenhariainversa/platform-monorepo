// Client-side React bindings, re-exported so the frontends depend only on
// `@repo/graphql` (never on `@apollo/client` directly). Import these from
// client components (`"use client"`).
export { ApolloProvider, useQuery, useMutation } from "@apollo/client/react";
export * from "./apollo-wrapper";
