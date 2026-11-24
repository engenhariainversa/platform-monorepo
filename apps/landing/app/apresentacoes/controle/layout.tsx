import type { Metadata } from "next";
import { presenterLinkMetadata } from "../../../lib/presentation-meta";
import { PresenterLinkProvider } from "../../../components/presenter-link";

// A private control page: never indexed, no Referer header leaves it, and its
// share card is the fixed "Link de apresentador" one. The token sits in the
// URL fragment, which never reaches the server or a scraper, so no preview
// here can name the deck.
export const metadata: Metadata = presenterLinkMetadata();

export default function PresenterLinkLayout({ children }: { children: React.ReactNode }) {
  return <PresenterLinkProvider>{children}</PresenterLinkProvider>;
}
