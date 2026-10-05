import { print, type DocumentNode } from "graphql";

/** Query text of a gql document, for plain `fetch` calls (server components). */
export function documentText(doc: DocumentNode): string {
  return print(doc);
}
