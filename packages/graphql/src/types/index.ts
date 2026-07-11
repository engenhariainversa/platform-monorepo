// Domain types live in the standalone, framework-agnostic @repo/types package.
// Re-exported here so typed query generics (e.g. useQuery<{ live: LiveData }>)
// and the `@repo/graphql` barrel keep a single import surface.
export * from "@repo/types";
